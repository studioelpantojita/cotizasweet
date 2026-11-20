using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;

public sealed record BackupOptions(string Directory, TimeSpan Interval, int Keep)
{
    public bool Enabled => Interval > TimeSpan.Zero;

    public static BackupOptions From(IConfiguration configuration, string databasePath)
    {
        static int Number(string? value, int fallback, int minimum, int maximum, string name)
        {
            if (string.IsNullOrWhiteSpace(value)) return fallback;
            var text = value.Trim();
            if (!Regex.IsMatch(text, "^[0-9]{1,4}$", RegexOptions.CultureInvariant) ||
                !int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var number) ||
                number < minimum || number > maximum)
                throw new InvalidOperationException($"{name} debe ser un entero entre {minimum} y {maximum}.");
            return number;
        }

        var hours = Number(configuration["BACKUP_INTERVAL_HOURS"], 24, 0, 168, "BACKUP_INTERVAL_HOURS");
        var keep = Number(configuration["BACKUP_KEEP"], 7, 1, 365, "BACKUP_KEEP");
        var directory = configuration["BACKUP_DIR"];
        if (string.IsNullOrWhiteSpace(directory))
            directory = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(databasePath))!, "backups");
        if (directory.Any(char.IsControl))
            throw new InvalidOperationException("BACKUP_DIR debe ser una ruta de directorio válida.");
        try
        {
            return new BackupOptions(Path.GetFullPath(directory), TimeSpan.FromHours(hours), keep);
        }
        catch (Exception error) when (error is ArgumentException or NotSupportedException or PathTooLongException)
        {
            throw new InvalidOperationException("BACKUP_DIR debe ser una ruta de directorio válida.");
        }
    }
}

public sealed class QuoteBackup(string databasePath, BackupOptions? configuredOptions = null)
{
    readonly BackupOptions options = configuredOptions ?? BackupOptions.From(new ConfigurationBuilder().Build(), databasePath);
    static readonly Regex OwnedFile = new(@"\Acotiza-([0-9]{8}T[0-9]{9}Z)-[a-f0-9]{32}\.sqlite\z",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);
    readonly string database = Path.GetFullPath(databasePath);
    public bool Enabled => options.Enabled;

    public bool CreateIfDue(DateTimeOffset now)
    {
        if (!Enabled) return false;
        now = now.ToUniversalTime();
        var directory = options.Directory;
        Directory.CreateDirectory(directory);
        if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
            throw new IOException("El directorio de respaldos no puede ser un enlace.");
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(directory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);

        // Prevent duplicate snapshots when two .NET processes overlap during a restart.
        var lockPath = Path.Combine(directory, ".schedule.lock");
        if (File.Exists(lockPath) && (File.GetAttributes(lockPath) & FileAttributes.ReparsePoint) != 0)
            throw new IOException("El archivo del planificador no puede ser un enlace.");
        using var gate = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        var complete = Snapshots(directory).ToArray();
        if (complete.Length > 0 && now - complete[0].Time < options.Interval)
        {
            Prune(complete);
            return false;
        }

        var stamp = now.ToString("yyyyMMdd'T'HHmmssfff'Z'", CultureInfo.InvariantCulture);
        var final = Path.Combine(directory, $"cotiza-{stamp}-{Guid.NewGuid():N}.sqlite");
        var temp = final + ".tmp";
        var tempMetadata = temp + ".metadata.json";
        var metadata = final + ".metadata.json";
        var publishedDatabase = false;
        var publishedMetadata = false;
        try
        {
            using (NewPrivateFile(temp)) { }
            using (var source = Open(database, SqliteOpenMode.ReadOnly))
            using (var copy = Open(temp, SqliteOpenMode.ReadWrite))
            {
                source.BackupDatabase(copy);
                using var mode = copy.CreateCommand();
                mode.CommandText = "PRAGMA journal_mode=DELETE";
                if (!string.Equals(mode.ExecuteScalar() as string, "delete", StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("No se pudo consolidar el respaldo.");
                using var check = copy.CreateCommand();
                check.CommandText = "PRAGMA integrity_check";
                using var result = check.ExecuteReader();
                if (!result.Read() || result.GetString(0) != "ok" || result.Read())
                    throw new InvalidDataException("SQLite rechazó la integridad del respaldo.");
            }

            using (var stream = new FileStream(temp, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
                stream.Flush(flushToDisk: true);
            string hash;
            long length;
            using (var stream = File.OpenRead(temp))
            {
                hash = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
                length = stream.Length;
            }
            using (var stream = NewPrivateFile(tempMetadata))
            {
                JsonSerializer.Serialize(stream, new
                {
                    schemaVersion = 1, operation = "backup", createdAtUtc = now,
                    bytes = length, sha256 = hash, sqliteIntegrity = "ok"
                });
                stream.Flush(flushToDisk: true);
            }

            File.Move(temp, final);
            publishedDatabase = true;
            File.Move(tempMetadata, metadata);
            publishedMetadata = true;
            Prune(Snapshots(directory));
            return true;
        }
        finally
        {
            if (publishedDatabase && !publishedMetadata) File.Delete(final);
            File.Delete(tempMetadata);
            File.Delete(temp);
            File.Delete(temp + "-wal");
            File.Delete(temp + "-shm");
            File.Delete(temp + "-journal");
        }
    }

    static SqliteConnection Open(string path, SqliteOpenMode mode)
    {
        var db = new SqliteConnection(new SqliteConnectionStringBuilder
            { DataSource = path, Mode = mode, Pooling = false, DefaultTimeout = 5 }.ToString());
        try { db.Open(); return db; }
        catch { db.Dispose(); throw; }
    }

    static FileStream NewPrivateFile(string path)
    {
        var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write };
        if (!OperatingSystem.IsWindows())
            options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
        return new FileStream(path, options);
    }

    static IEnumerable<(string Path, DateTimeOffset Time)> Snapshots(string directory)
    {
        var snapshots = new List<(string Path, DateTimeOffset Time)>();
        foreach (var path in Directory.EnumerateFiles(directory, "cotiza-*.sqlite"))
        {
            var match = OwnedFile.Match(Path.GetFileName(path));
            if (match.Success && DateTimeOffset.TryParseExact(match.Groups[1].Value,
                "yyyyMMdd'T'HHmmssfff'Z'", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal,
                out var time) && HasMetadata(path))
                snapshots.Add((path, time));
        }
        return snapshots.OrderByDescending(entry => entry.Time);
    }

    static bool HasMetadata(string path)
    {
        var sidecar = path + ".metadata.json";
        if (!File.Exists(sidecar) ||
            (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0 ||
            (File.GetAttributes(sidecar) & FileAttributes.ReparsePoint) != 0 ||
            new FileInfo(sidecar).Length > 16_384)
            return false;
        try
        {
            using var data = JsonDocument.Parse(File.ReadAllBytes(sidecar));
            var m = data.RootElement;
            var valid = m.TryGetProperty("schemaVersion", out var v) && v.GetInt32() == 1 &&
                m.TryGetProperty("operation", out var op) && op.GetString() == "backup" &&
                m.TryGetProperty("bytes", out var size) && size.GetInt64() == new FileInfo(path).Length &&
                m.TryGetProperty("sha256", out var hash) && hash.GetString() is { Length: 64 } &&
                m.TryGetProperty("sqliteIntegrity", out var integrity) && integrity.GetString() == "ok";
            if (!valid) return false;
            using var snapshot = File.OpenRead(path);
            return string.Equals(Convert.ToHexString(SHA256.HashData(snapshot)), m.GetProperty("sha256").GetString(),
                StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or FormatException or IOException)
        {
            return false;
        }
    }

    void Prune(IEnumerable<(string Path, DateTimeOffset Time)> complete)
    {
        foreach (var (path, _) in complete.Skip(options.Keep))
        {
            File.Delete(path + ".metadata.json");
            File.Delete(path);
        }
    }
}

public sealed class QuoteBackupWorker(QuoteBackup backup, TimeProvider clock, ILogger<QuoteBackupWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!backup.Enabled)
        {
            logger.LogInformation("El respaldo automático está desactivado en la configuración.");
            return;
        }
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1), clock);
        try
        {
            do
            {
                if (stoppingToken.IsCancellationRequested) return;
                try
                {
                    if (backup.CreateIfDue(clock.GetUtcNow()))
                        logger.LogInformation("Se completó el respaldo automático de cotizaciones.");
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception error)
                {
                    // Paths and exception messages may contain private deployment information.
                    logger.LogWarning("Falló el respaldo automático ({FailureType}). Se reintentará en la próxima comprobación.", error.GetType().Name);
                }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
