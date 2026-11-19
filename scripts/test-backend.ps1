[CmdletBinding()]
param(
    [switch]$Integration,
    [switch]$Browser,
    [switch]$NoRestore,
    [string]$PythonPath,
    [string]$NodePath,
    [string]$DotnetPath,
    [ValidateSet('chromium','msedge','chrome')][string]$BrowserChannel = 'chromium'
)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$settings=Join-Path $root 'local.settings.json'
if(Test-Path -LiteralPath $settings){
    $local=Get-Content -LiteralPath $settings -Raw -Encoding UTF8 | ConvertFrom-Json
    if(!$PythonPath){$PythonPath=$local.python}
    if(!$NodePath){$NodePath=$local.node}
    if(!$DotnetPath){$DotnetPath=$local.dotnet}
}
if(!$PythonPath){$PythonPath=Join-Path $root '.venv/Scripts/python.exe'}
if(!$NodePath){$NodePath='node'}
if(!$DotnetPath){$DotnetPath='dotnet'}
function Invoke-Checked([string]$File,[string[]]$Arguments){
    & $File @Arguments
    if($LASTEXITCODE -ne 0){throw "Falló $([IO.Path]::GetFileName($File)) $($Arguments[0]) (código $LASTEXITCODE)."}
}
$env:PYTHONUTF8='1'
$env:NODE_EXEC=(Get-Command $NodePath -ErrorAction Stop).Source
$env:DOTNET_EXEC=(Get-Command $DotnetPath -ErrorAction Stop).Source
$env:RUN_BROWSER_E2E=if($Browser){'1'}else{'0'}
$env:E2E_BROWSER_CHANNEL=if($BrowserChannel -eq 'chromium'){''}else{$BrowserChannel}
$env:NEXT_TELEMETRY_DISABLED='1'
Push-Location $root
try{
    $projects=@('EA-Cotiza.slnx','tests/security_backend/DotnetSecurityChecks.csproj','tests/v2/dotnet-probe/FinancialProbe.csproj')
    foreach($project in $projects){
        if(!$NoRestore){Invoke-Checked $env:DOTNET_EXEC @('restore',$project,'--locked-mode')}
        Invoke-Checked $env:DOTNET_EXEC @('build',$project,'-c','Release','--no-restore')
    }
    Invoke-Checked $PythonPath @('-m','pytest','tests/security_backend','tests/operations','tests/dependencies','-q')
    Invoke-Checked $env:DOTNET_EXEC @('tests/security_backend/bin/Release/net10.0/DotnetSecurityChecks.dll')
    Invoke-Checked $PythonPath @('tests/v2/run_quality.py','--node',$env:NODE_EXEC,'--dotnet-probe','tests/v2/dotnet-probe/bin/Release/net10.0/FinancialProbe.dll')
    if($Integration -or $Browser){Invoke-Checked $PythonPath @('tests/integration.py','--backend','all')}
}finally{Pop-Location}
