param([ValidatePattern('^[A-Za-z0-9_.-]+$')][string]$Repository='cotizasweet')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$gitArguments=@('-c',"safe.directory=$projectRoot",'-C',$projectRoot)
if(!(Get-Command gh -ErrorAction SilentlyContinue)){throw 'Instala GitHub CLI desde https://cli.github.com/ y vuelve a ejecutar este script.'}
& gh auth status --hostname github.com
if($LASTEXITCODE -ne 0){
    & gh auth login --hostname github.com --git-protocol https --web
    if($LASTEXITCODE -ne 0){throw 'No se completó la autorización de la cuenta GitHub.'}
}
$account=(& gh api user | ConvertFrom-Json)
if($LASTEXITCODE -ne 0 -or !$account.login -or !$account.id){throw 'No se pudo verificar la cuenta personal.'}
$fullName="$($account.login)/$Repository"
$target="https://github.com/$fullName.git"
& git @gitArguments rev-parse --git-dir 2>$null
if($LASTEXITCODE -ne 0){
    & git -C $projectRoot init --initial-branch=main
    if($LASTEXITCODE -ne 0){throw 'No se pudo inicializar Git.'}
}
$existingRemote=& git @gitArguments remote get-url origin 2>$null
if($existingRemote -and $existingRemote -ne $target -and $existingRemote -ne "https://github.com/$fullName") {throw 'El repositorio local ya apunta a otro destino. Revisa origin antes de publicar.'}
& git @gitArguments config user.name $account.login
& git @gitArguments config user.email "$($account.id)+$($account.login)@users.noreply.github.com"
& git @gitArguments add --all
if($LASTEXITCODE -ne 0){throw 'No se pudieron preparar los archivos de Git.'}
$tracked=& git @gitArguments ls-files
foreach($file in $tracked){
    if($file -match '(^|/)(data|logs|backups|node_modules|\.venv|artifacts)/' -or $file -match '\.sqlite' -or ($file -match '(^|/)\.env' -and $file -notmatch '\.example$') -or $file -match '(^|/)(local\.settings\.json|Local\.Build\.props)$'){throw "Archivo privado o de ejecución detectado: $file"}
}
& git @gitArguments diff --cached --quiet
if($LASTEXITCODE -eq 1){
    & git @gitArguments commit -m 'Prepare CotizaSweet 2.1.0 for GitHub and Railway'
    if($LASTEXITCODE -ne 0){throw 'No se pudo crear el commit.'}
}
$remote=& gh repo view $fullName --json isEmpty,visibility 2>$null
if($LASTEXITCODE -eq 0){
    $details=$remote | ConvertFrom-Json
    if(!$details.isEmpty){throw 'El repositorio remoto ya contiene cambios. No se realizará un push sobre un historial no revisado.'}
    if($details.visibility -ne 'PUBLIC'){throw 'El repositorio existente no es público. Revisa su configuración antes de continuar.'}
    if(!$existingRemote){& git @gitArguments remote add origin $target}
    & git @gitArguments push --set-upstream origin main
}else{
    & gh repo create $fullName --public --description 'CotizaSweet: cotizaciones, catálogo y PDF con Next.js, .NET y Python' --source $projectRoot --remote origin --push
}
if($LASTEXITCODE -ne 0){throw 'La publicación no se completó. No se ha utilizado push forzado.'}
Write-Output "Repositorio: https://github.com/$fullName"
Write-Output "Acciones: https://github.com/$fullName/actions"
Write-Output 'Verifica los workflows antes de crear recursos de alojamiento.'
