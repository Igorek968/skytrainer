# Sync live instructor profiles from local DB to VPS (utrainer.ru).
param(
  [string]$SshHost = "vps",
  [string]$RemoteDir = "/opt/skytrainer",
  [string]$LocalDbUrl = "postgres://sky:sky@postgres:5432/skytrainer_new?schema=skiinstruct"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$exportFile = Join-Path $env:TEMP "instructors-sync.json"
$uploadsDir = Join-Path (Get-Location) "skiinstruct\public\uploads\instructors"

Write-Host "Export instructors from local DB..."
docker cp skiinstruct/scripts/sync-instructors.ts skiinstruct-web:/app/scripts/sync-instructors.ts
docker exec -e DATABASE_URL=$LocalDbUrl skiinstruct-web sh -c "npx tsx scripts/sync-instructors.ts export > /tmp/instructors-sync.json"
if ($LASTEXITCODE -ne 0) { throw "Export failed" }
docker cp skiinstruct-web:/tmp/instructors-sync.json $exportFile

$parsed = Get-Content $exportFile -Raw | ConvertFrom-Json
Write-Host ("Found {0} instructor(s): {1}" -f $parsed.Count, (($parsed | ForEach-Object { $_.email }) -join ", "))

Write-Host "Upload JSON and photos to VPS..."
scp $exportFile "${SshHost}:/tmp/instructors-sync.json"
ssh $SshHost "mkdir -p $RemoteDir/deploy/skiinstruct-uploads/instructors"
if (Test-Path $uploadsDir) {
  scp -r "$uploadsDir/*" "${SshHost}:${RemoteDir}/deploy/skiinstruct-uploads/instructors/"
}

Write-Host "Import on VPS..."
scp skiinstruct/scripts/sync-instructors.ts "${SshHost}:/tmp/sync-instructors.ts"
ssh $SshHost "docker exec skiinstruct-qa-web mkdir -p /app/scripts; docker cp /tmp/sync-instructors.ts skiinstruct-qa-web:/app/scripts/sync-instructors.ts; docker cp /tmp/instructors-sync.json skiinstruct-qa-web:/tmp/instructors-sync.json; docker exec skiinstruct-qa-web npx tsx scripts/sync-instructors.ts import /tmp/instructors-sync.json"

Write-Host "Done. Check https://utrainer.ru/client (hard refresh)."
