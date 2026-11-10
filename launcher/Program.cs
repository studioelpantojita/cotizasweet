using System.Diagnostics;
using System.Text.Json;

var directory = new DirectoryInfo(AppContext.BaseDirectory);
while (directory != null && !File.Exists(Path.Combine(directory.FullName, "scripts", "start-local.py")))
    directory = directory.Parent;
if (directory == null) throw new DirectoryNotFoundException("No se encontró la raíz del proyecto.");
var root = directory.FullName;
var settingsPath = Path.Combine(root, "local.settings.json");
if (!File.Exists(settingsPath)) throw new FileNotFoundException("Ejecuta scripts/setup-local.ps1 para configurar las rutas de los runtimes.");
using var settings = JsonDocument.Parse(File.ReadAllText(settingsPath));
var python = settings.RootElement.GetProperty("python").GetString()!;
var start = new ProcessStartInfo(python) { WorkingDirectory = root, UseShellExecute = false };
start.ArgumentList.Add(Path.Combine(root, "scripts", "start-local.py"));
#if DEBUG
start.ArgumentList.Add("--configuration=Debug");
#else
start.ArgumentList.Add("--configuration=Release");
#endif
start.Environment["PYTHONUTF8"] = "1";
if (settings.RootElement.TryGetProperty("pythonModules", out var modules)) start.Environment["PYTHONPATH"] = modules.GetString();
using var child = Process.Start(start) ?? throw new InvalidOperationException("No se pudo iniciar Python.");
using var processTree = WindowsProcessTree.Attach(child);
Console.CancelKeyPress += (_, e) => { e.Cancel = true; try { child.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } };
AppDomain.CurrentDomain.ProcessExit += (_, _) => { try { if (!child.HasExited) child.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } };
await child.WaitForExitAsync();
return child.ExitCode;
