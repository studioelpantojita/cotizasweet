# Ejecuta localmente las pruebas de backend del workflow de CI (.github/workflows/ci.yml).
# Usa los ejecutables registrados en local.settings.json por setup-local.ps1.
#   .\scripts\test-backend.ps1                  # compilación .NET, seguridad, Python y paridad
#   .\scripts\test-backend.ps1 -Integration     # además, OIDC/API con procesos reales (consume más RAM)
#   .\scripts\test-backend.ps1 -SkipBuild       # reutiliza la compilación Release existente
#   .\scripts\test-backend.ps1 -Integration -Browser   # además, 18 comprobaciones Playwright (con el backend .NET)
param([switch]$Integration,[switch]$Browser,[switch]$SkipBuild,[ValidateSet('next','python','dotnet','all')][string]$Backend='all')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$settingsPath=Join-Path $root 'local.settings.json'
if(!(Test-Path -LiteralPath $settingsPath)){throw 'Falta local.settings.json. Ejecuta antes .\scripts\setup-local.ps1.'}
$settings=Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$py=$settings.python;$dn=$settings.dotnet;$node=$settings.node
$env:PYTHONUTF8='1';$env:DOTNET_CLI_TELEMETRY_OPTOUT='1';$env:DOTNET_NOLOGO='1';$env:PIP_DISABLE_PIP_VERSION_CHECK='1';$env:NODE_EXEC=$node
$results=[ordered]@{}
function Step([string]$name,[scriptblock]$action){
  Write-Host "`n== $name" -ForegroundColor Cyan
  $started=Get-Date
  # Windows PowerShell 5.1 convierte el stderr redirigido en errores; solo cuenta el código de salida.
  $ErrorActionPreference='Continue'
  & $action
  $ok=$LASTEXITCODE -eq 0
  $results[$name]=if($ok){'OK'}else{"FALLÓ (código $LASTEXITCODE)"}
  Write-Host ("{0} en {1:N1} s" -f $results[$name],((Get-Date)-$started).TotalSeconds) -ForegroundColor $(if($ok){'Green'}else{'Red'})
  if(!$ok){Summary;exit 1}
}
function Summary{Write-Host "`nResumen" -ForegroundColor Cyan;$results.GetEnumerator()|ForEach-Object{"  {0,-48} {1}" -f $_.Key,$_.Value}}

New-Item -ItemType Directory -Force (Join-Path $root 'tests/artifacts') | Out-Null
Step 'Dependencias Python de QA' {& $py -m pip install -q -r requirements-qa.txt}
$projects=@('EA-Cotiza.slnx','tests/v2/dotnet-probe/FinancialProbe.csproj','tests/security_backend/DotnetSecurityChecks.csproj')
if(!$SkipBuild){
  foreach($p in $projects){
    Step "Restaurar y auditar $p" {& $dn restore $p --locked-mode -p:NuGetAudit=true -p:NuGetAuditMode=all -p:TreatWarningsAsErrors=true}
    Step "Compilar $p (Release)" {& $dn build $p -c Release --no-restore -nologo -v:q}
  }
}
Step 'Seguridad de entrada .NET' {& $dn tests/security_backend/bin/Release/net10.0/DotnetSecurityChecks.dll}
Step 'Catálogo Python' {& $py tests/catalog_test.py}
Step 'Seguridad, operaciones y dependencias Python' {& $py -m pytest tests/security_backend tests/operations tests/dependencies -q -p no:warnings --junitxml=tests/artifacts/python-tests.xml}
Step 'Paridad financiera TS/.NET/Python, mutaciones y SQLite' {& $py tests/v2/run_quality.py --node $node --dotnet-probe tests/v2/dotnet-probe/bin/Release/net10.0/FinancialProbe.dll}
if($Integration){
  $free=(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB
  if($Browser){
    if($Backend -notin @('dotnet','all')){throw 'Las pruebas de navegador se ejecutan con el backend dotnet o all.'}
    Push-Location (Join-Path $root 'web')
    try{Step 'Chromium de Playwright' {& $node node_modules/playwright/cli.js install chromium}}finally{Pop-Location}
    $env:RUN_BROWSER_E2E='1'
  }
  if($free -lt 2){Write-Warning ("Solo hay {0:N1} GB de RAM libres; la prueba integrada levanta Next.js, .NET, Python e identidad OIDC." -f $free)}
  Step "Integración OIDC y API con procesos reales ($Backend)" {& $py tests/integration.py --backend $Backend}
}
Summary
