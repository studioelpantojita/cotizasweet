using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;

/// Scheduled, consistent snapshots of the quotes database. Each copy passes
/// PRAGMA integrity_check and gets the same `<file>.metadata.json` sidecar that
/// scripts/backup_sqlite.py writes, so `backup_sqlite.py verify|restore` work on it.
/// Copies live next to the database by default: they protect against corruption and
/// mistakes, not against losing the whole volume (that needs an off-site copy).
public sealed record BackupOptions(string Directory,TimeSpan Interval,int Keep)
{
    public bool Enabled => Interval>TimeSpan.Zero;
    public static BackupOptions From(IConfiguration config,string databasePath)
    {
        static int Number(string? value,int fallback,int min,int max,string name)
        {
            if(string.IsNullOrWhiteSpace(value))return fallback;
            var text=value.Trim();
            var n=Regex.IsMatch(text,"^[0-9]{1,4}$")?int.Parse(text,CultureInfo.InvariantCulture):-1;
            if(n<min || n>max)throw new InvalidOperationException($"{name} debe ser un entero entre {min} y {max}.");
            return n;
        }
        var hours=Number(config["BACKUP_INTERVAL_HOURS"],24,0,168,"BACKUP_INTERVAL_HOURS");
        var keep=Number(config["BACKUP_KEEP"],7,1,365,"BACKUP_KEEP");
        var dir=config["BACKUP_DIR"] is {Length:>0} custom?custom:Path.Combine(Path.GetDirectoryName(Path.GetFullPath(databasePath))!,"backups");
        return new(Path.GetFullPath(dir),TimeSpan.FromHours(hours),keep);
    }
}

public static class QuoteBackup
{
    static readonly Regex Name=new(@"^quotes-[0-9]{8}T[0-9]{6}Z\.sqlite$",RegexOptions.CultureInvariant);

    /// Writes one verified snapshot and removes the oldest beyond `keep`. Returns its path.
    public static string RunOnce(string databasePath,BackupOptions options,DateTime utcNow)
    {
        Directory.CreateDirectory(options.Directory);
        if(!OperatingSystem.IsWindows())File.SetUnixFileMode(options.Directory,UnixFileMode.UserRead|UnixFileMode.UserWrite|UnixFileMode.UserExecute);
        var target=Path.Combine(options.Directory,$"quotes-{utcNow:yyyyMMdd'T'HHmmss'Z'}.sqlite");
        if(File.Exists(target) || File.Exists(target+".metadata.json"))throw new IOException("Ya existe un respaldo con esa marca de tiempo.");
        var temporary=Path.Combine(options.Directory,$".snapshot-{Guid.NewGuid():N}.tmp");
        try {
            // Pooling=false releases file handles at once so the snapshot can be moved on Windows.
            using(var source=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=databasePath,Mode=SqliteOpenMode.ReadOnly,Pooling=false,DefaultTimeout=10}.ToString()))
            using(var copy=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=temporary,Pooling=false}.ToString())) {
                source.Open();copy.Open();
                source.BackupDatabase(copy); // online backup API: includes committed WAL pages
                using var check=copy.CreateCommand();check.CommandText="PRAGMA integrity_check";
                if(check.ExecuteScalar() as string!="ok")throw new InvalidDataException("SQLite no confirmó la integridad del respaldo.");
                using var journal=copy.CreateCommand();journal.CommandText="PRAGMA journal_mode=DELETE";journal.ExecuteNonQuery();
            }
            File.Move(temporary,target);
        } finally { File.Delete(temporary); }
        var sidecarPath=target+".metadata.json";
        try {
            if(!OperatingSystem.IsWindows())File.SetUnixFileMode(target,UnixFileMode.UserRead|UnixFileMode.UserWrite);
            // Utf8JsonWriter needs no reflection, so this also works in trimmed/AOT builds.
            using(var sidecar=new FileStream(sidecarPath,FileMode.CreateNew,FileAccess.Write))
            using(var json=new Utf8JsonWriter(sidecar,new JsonWriterOptions{Indented=true})) {
                json.WriteStartObject();
                json.WriteNumber("schemaVersion",1);json.WriteString("operation","backup");
                json.WriteString("createdAtUtc",utcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.ffffff'+00:00'",CultureInfo.InvariantCulture));
                json.WriteNumber("bytes",new FileInfo(target).Length);json.WriteString("sha256",Sha256(target));json.WriteString("sqliteIntegrity","ok");
                json.WriteEndObject();json.Flush();sidecar.WriteByte((byte)'\n');sidecar.Flush(true);
            }
            if(!OperatingSystem.IsWindows())File.SetUnixFileMode(sidecarPath,UnixFileMode.UserRead|UnixFileMode.UserWrite);
        } catch {
            // Never leave a copy without valid metadata, as scripts/backup_sqlite.py guarantees.
            File.Delete(sidecarPath);File.Delete(target);throw;
        }
        Prune(options);
        return target;
    }

    /// Keeps the newest `Keep` snapshots made by this service; never touches other files.
    public static void Prune(BackupOptions options)
    {
        foreach(var stale in Directory.EnumerateFiles(options.Directory,".snapshot-*.tmp"))File.Delete(stale);
        var copies=Directory.EnumerateFiles(options.Directory,"quotes-*.sqlite").Where(f=>Name.IsMatch(Path.GetFileName(f))).OrderByDescending(f=>Path.GetFileName(f),StringComparer.Ordinal).ToList();
        foreach(var old in copies.Skip(options.Keep)){File.Delete(old);File.Delete(old+".metadata.json");}
    }

    static string Sha256(string file){using var stream=File.OpenRead(file);return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();}
}

public sealed class QuoteBackupService(QuoteStore store,BackupOptions options,ILogger<QuoteBackupService> logger):BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        if(!options.Enabled){logger.LogInformation("Respaldo automático desactivado (BACKUP_INTERVAL_HOURS=0).");return;}
        // A short delay keeps the first copy out of the startup path.
        try{await Task.Delay(TimeSpan.FromMinutes(1),stopping);}catch(OperationCanceledException){return;}
        while(!stopping.IsCancellationRequested) {
            try {
                var file=QuoteBackup.RunOnce(store.DatabasePath,options,DateTime.UtcNow);
                logger.LogInformation("Respaldo verificado: {File}; se conservan {Keep}.",Path.GetFileName(file),options.Keep);
            } catch(Exception e) {
                // Log and retry next interval: an unhandled exception in a BackgroundService
                // stops the whole host by default (.NET 8+), which would take the API down.
                logger.LogError("Falló el respaldo automático: {Reason}",e.GetType().Name);
            }
            try{await Task.Delay(options.Interval,stopping);}catch(OperationCanceledException){return;}
        }
    }
}
