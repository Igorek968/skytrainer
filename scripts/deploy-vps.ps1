# Деплой SkiInstruct QA на VPS (SSH host "vps" из ~/.ssh/config).
param(
  [string]$SshHost = "vps",
  [string]$RemoteDir = "/opt/skytrainer",
  [string]$EnvFile = ".env.qa",
  [switch]$SyncInstructors = $true
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (!(Test-Path $EnvFile)) {
  Write-Error "Создайте $EnvFile из .env.qa.example (APP_DOMAIN, пароли, секреты)."
}

$archive = Join-Path $env:TEMP "skytrainer-deploy.tar.gz"
Write-Host "Архив проекта..."
tar -czf $archive `
  --exclude=node_modules --exclude=.next --exclude=.git --exclude="*.tar.gz" `
  --exclude=skiinstruct/node_modules --exclude=skiinstruct/.next .

Write-Host "Загрузка на $SshHost..."
scp $archive "${SshHost}:/tmp/skytrainer-deploy.tar.gz"
scp $EnvFile "${SshHost}:${RemoteDir}/.env.qa"

$dataDir = Join-Path (Get-Location) "deploy\caddy-data"
$configDir = Join-Path (Get-Location) "deploy\caddy-config"
$hasCerts = (Get-ChildItem $dataDir -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne ".gitkeep" }).Count -gt 0
if ($hasCerts) {
  Write-Host "Загрузка сохранённых сертификатов Caddy..."
  ssh $SshHost "mkdir -p $RemoteDir/deploy/caddy-data $RemoteDir/deploy/caddy-config"
  scp -r "$dataDir/*" "${SshHost}:${RemoteDir}/deploy/caddy-data/"
  if ((Get-ChildItem $configDir -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne ".gitkeep" }).Count -gt 0) {
    scp -r "$configDir/*" "${SshHost}:${RemoteDir}/deploy/caddy-config/"
  }
}

ssh $SshHost "set -e; mkdir -p $RemoteDir/deploy/caddy-data $RemoteDir/deploy/caddy-config; tar xzf /tmp/skytrainer-deploy.tar.gz -C $RemoteDir; cd $RemoteDir; docker compose --env-file .env.qa -f docker-compose.qa.yml up -d --build; docker compose --env-file .env.qa -f docker-compose.qa.yml ps"

$domain = $null
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  if ($null -eq $domain -and $_ -match '^\s*APP_DOMAIN=(.+)$') {
    $domain = $Matches[1].Trim()
  }
}
if (-not $domain) {
  Write-Warning "APP_DOMAIN не найден в $EnvFile"
  $domain = "localhost"
}
if ($SyncInstructors) {
  Write-Host ""
  Write-Host "Sync instructor profiles and photos to VPS..."
  & (Join-Path $PSScriptRoot "sync-instructors-to-vps.ps1") -SshHost $SshHost -RemoteDir $RemoteDir
}

Write-Host ""
Write-Host "Готово. Откройте: https://$domain"
Write-Host "После первой выдачи TLS: .\scripts\caddy-sync-certs.ps1 -Direction Pull"