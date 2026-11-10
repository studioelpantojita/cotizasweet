param([string]$NodePath='node',[string]$PythonPath='python',[string]$DotnetPath='dotnet',
      [int]$WebPort=3340,[int]$ApiPort=8340,[int]$RucPort=8341,[int]$IdentityPort=9340)
$ErrorActionPreference='Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
function Resolve-Executable([string]$name) { (Get-Command $name -ErrorAction Stop).Source }
$nodeExe=Resolve-Executable $NodePath
$pythonExe=Resolve-Executable $PythonPath
$dotnetExe=Resolve-Executable $DotnetPath
$major=[int]((& $nodeExe --version).TrimStart('v').Split('.')[0])
if($major -lt 24){throw 'Se requiere Node.js 24 o posterior. Indica su ruta con -NodePath.'}
& $pythonExe -c 'import sys; assert sys.version_info >= (3, 12), "Se requiere Python 3.12 o posterior"'
if($LASTEXITCODE -ne 0){throw 'Versión de Python incompatible.'}
& $pythonExe -m venv (Join-Path $projectRoot '.venv')
if($LASTEXITCODE -ne 0){throw 'No se pudo crear el entorno Python.'}
$venvPython=Join-Path $projectRoot '.venv/Scripts/python.exe'
& $venvPython -m pip install -r (Join-Path $projectRoot 'api-python/requirements.lock.txt')
if($LASTEXITCODE -ne 0){throw 'Falló la instalación Python.'}
$npm=Join-Path (Split-Path $nodeExe) 'node_modules/npm/bin/npm-cli.js'
if(!(Test-Path $npm)){throw 'No se encontró npm junto a Node. Instala una distribución completa de Node.js.'}
Push-Location (Join-Path $projectRoot 'web')
try { & $nodeExe $npm ci; if($LASTEXITCODE -ne 0){throw 'Falló npm ci.'} } finally { Pop-Location }
& $dotnetExe restore (Join-Path $projectRoot 'EA-Cotiza.slnx') --locked-mode
if($LASTEXITCODE -ne 0){throw 'Falló la restauración .NET.'}
$settingsPath=Join-Path $projectRoot 'local.settings.json'
$ports=@{web=$WebPort;api=$ApiPort;ruc=$RucPort;identity=$IdentityPort}
if(Test-Path -LiteralPath $settingsPath){
    $previous=Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    if($previous.ports -and !($PSBoundParameters.Keys | Where-Object {$_ -like '*Port'})){$ports=$previous.ports}
}
@{node=$nodeExe;python=$venvPython;dotnet=$dotnetExe;ports=$ports} | ConvertTo-Json | Set-Content $settingsPath -Encoding utf8
$privateConfig=Join-Path $projectRoot '.env.ruc.local'
if(!(Test-Path $privateConfig)){Copy-Item (Join-Path $projectRoot '.env.ruc.example') $privateConfig}
Write-Output 'Entorno preparado. Configura .env.ruc.local, abre EA-Cotiza.slnx y ejecuta EA.Cotiza.Local con F5.'
