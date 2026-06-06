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

Write-Host "Sync published events..."
$eventsFile = Join-Path $env:TEMP "events-sync.json"
$eventsUploads = Join-Path (Get-Location) "skiinstruct\public\uploads\events"
docker cp skiinstruct/scripts/sync-events.mjs skiinstruct-web:/app/scripts/sync-events.mjs
docker exec -e DATABASE_URL=$LocalDbUrl skiinstruct-web sh -c "node scripts/sync-events.mjs export > /tmp/events-sync.json"
if ($LASTEXITCODE -eq 0) {
  docker cp skiinstruct-web:/tmp/events-sync.json $eventsFile
  $evParsed = Get-Content $eventsFile -Raw | ConvertFrom-Json
  Write-Host ("Found {0} published event(s)" -f @($evParsed).Count)
  if (@($evParsed).Count -gt 0) {
    scp $eventsFile "${SshHost}:/tmp/events-sync.json"
    scp skiinstruct/scripts/sync-events.mjs "${SshHost}:/tmp/sync-events.mjs"
    if (Test-Path $eventsUploads) {
      ssh $SshHost "mkdir -p $RemoteDir/deploy/skiinstruct-uploads/events"
      scp -r "$eventsUploads/*" "${SshHost}:${RemoteDir}/deploy/skiinstruct-uploads/events/"
    }
    ssh $SshHost "docker cp /tmp/sync-events.mjs skiinstruct-qa-web:/app/scripts/sync-events.mjs; docker cp /tmp/events-sync.json skiinstruct-qa-web:/tmp/events-sync.json; docker exec skiinstruct-qa-web node scripts/sync-events.mjs import /tmp/events-sync.json"
  }
} else {
  Write-Warning "Events export skipped (local container not running?)"
}

Write-Host "Done. Check https://utrainer.ru/client (hard refresh)."
