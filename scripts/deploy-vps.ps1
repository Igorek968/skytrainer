# Deploy TvoyTrener.rf to VPS (SSH host "vps" from ~/.ssh/config).
param(
  [string]$SshHost = "vps",
  [string]$RemoteDir = "/opt/skytrainer",
  [string]$EnvFile = ".env.qa",
  [switch]$SyncInstructors = $true
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (!(Test-Path $EnvFile)) {
  Write-Error "Create $EnvFile from .env.qa.example (APP_DOMAIN, passwords, secrets)."
}

$archive = Join-Path $env:TEMP "skytrainer-deploy.tar.gz"
Write-Host "Archiving project..."
tar -czf $archive `
  --exclude=node_modules --exclude=.next --exclude=.git --exclude="*.tar.gz" `
  --exclude=skiinstruct/node_modules --exclude=skiinstruct/.next .

Write-Host "Uploading to $SshHost..."
scp $archive "${SshHost}:/tmp/skytrainer-deploy.tar.gz"
scp $EnvFile "${SshHost}:${RemoteDir}/.env.qa"

$dataDir = Join-Path (Get-Location) "deploy\caddy-data"
$configDir = Join-Path (Get-Location) "deploy\caddy-config"
$hasCerts = (Get-ChildItem $dataDir -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne ".gitkeep" }).Count -gt 0
if ($hasCerts) {
  Write-Host "Uploading saved Caddy certificates..."
  ssh $SshHost "mkdir -p $RemoteDir/deploy/caddy-data $RemoteDir/deploy/caddy-config"
  scp -r "$dataDir/*" "${SshHost}:${RemoteDir}/deploy/caddy-data/"
  if ((Get-ChildItem $configDir -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne ".gitkeep" }).Count -gt 0) {
    scp -r "$configDir/*" "${SshHost}:${RemoteDir}/deploy/caddy-config/"
  }
}

ssh $SshHost "set -e; mkdir -p $RemoteDir/deploy/caddy-data $RemoteDir/deploy/caddy-config $RemoteDir/deploy/skiinstruct-uploads/instructors $RemoteDir/deploy/skiinstruct-private-uploads/compliance $RemoteDir/deploy/skiinstruct-private-uploads/npd-receipts; rm -rf $RemoteDir/skiinstruct/src; tar xzf /tmp/skytrainer-deploy.tar.gz -C $RemoteDir; cd $RemoteDir; sudo docker compose --env-file .env.qa -f docker-compose.qa.yml up -d --build; sudo docker compose --env-file .env.qa -f docker-compose.qa.yml exec -T skiinstruct npx prisma db push; sudo docker compose --env-file .env.qa -f docker-compose.qa.yml ps"

$domain = $null
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  if ($null -eq $domain -and $_ -match '^\s*APP_DOMAIN=(.+)$') {
    $domain = $Matches[1].Trim()
  }
}
if (-not $domain) {
  Write-Warning "APP_DOMAIN not found in $EnvFile"
  $domain = "localhost"
}
if ($SyncInstructors) {
  Write-Host ""
  Write-Host "Sync instructor profiles and photos to VPS..."
  & (Join-Path $PSScriptRoot "sync-instructors-to-vps.ps1") -SshHost $SshHost -RemoteDir $RemoteDir
}

Write-Host ""
Write-Host "Done. Open: https://$domain"
Write-Host "After first TLS issue: .\scripts\caddy-sync-certs.ps1 -Direction Pull"
