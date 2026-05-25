# Деплой SkiInstruct QA на VPS (SSH host "vps" из ~/.ssh/config).
param(
  [string]$SshHost = "vps",
  [string]$RemoteDir = "/opt/skytrainer",
  [string]$EnvFile = ".env.qa"
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

$domain = (Select-String -Path $EnvFile -Pattern '^APP_DOMAIN=' | ForEach-Object { ($_ -split '=', 2)[1].Trim() }) | Select-Object -First 1
Write-Host "Готово. Проверьте: https://$domain"
Write-Host "После первого выпуска TLS: .\scripts\caddy-sync-certs.ps1 -Direction Pull"
