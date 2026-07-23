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
$container = "skiinstruct-web"
$remoteWeb = "skiinstruct-qa-web"

function Ensure-LocalSkiinstruct {
  $running = docker inspect -f "{{.State.Running}}" $container 2>$null
  if ($running -eq "true") { return }
  Write-Host "Local $container is not running - starting..."
  docker compose up -d skiinstruct | Out-Host
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 3
    $running = docker inspect -f "{{.State.Running}}" $container 2>$null
    if ($running -eq "true") {
      Start-Sleep -Seconds 5
      return
    }
  } while ((Get-Date) -lt $deadline)
  throw "Could not start $container. Check: docker compose logs skiinstruct"
}

Ensure-LocalSkiinstruct

Write-Host "Export instructors from local DB..."
docker cp skiinstruct/scripts/sync-instructors.ts "${container}:/app/scripts/sync-instructors.ts"
docker exec -e DATABASE_URL=$LocalDbUrl $container sh -c "npx tsx scripts/sync-instructors.ts export > /tmp/instructors-sync.json"
if ($LASTEXITCODE -ne 0) { throw "Export failed" }
docker cp "${container}:/tmp/instructors-sync.json" $exportFile

$parsed = Get-Content $exportFile -Raw | ConvertFrom-Json
$emails = ($parsed | ForEach-Object { $_.email }) -join ", "
Write-Host "Found $($parsed.Count) instructors: $emails"

Write-Host "Upload JSON and photos to VPS..."
scp $exportFile "${SshHost}:/tmp/instructors-sync.json"
ssh $SshHost "mkdir -p $RemoteDir/deploy/skiinstruct-uploads/instructors"
if (Test-Path $uploadsDir) {
  $photoCount = @(Get-ChildItem -Path $uploadsDir -File -Recurse -ErrorAction SilentlyContinue).Count
  Write-Host "Uploading instructor photos: $photoCount"
  scp -r "$uploadsDir/*" "${SshHost}:${RemoteDir}/deploy/skiinstruct-uploads/instructors/"
} else {
  Write-Warning "No local instructor uploads dir: $uploadsDir"
}

Write-Host "Import on VPS..."
scp skiinstruct/scripts/sync-instructors.ts "${SshHost}:/tmp/sync-instructors.ts"
ssh $SshHost "sudo docker exec $remoteWeb mkdir -p /app/scripts; sudo docker cp /tmp/sync-instructors.ts ${remoteWeb}:/app/scripts/sync-instructors.ts; sudo docker cp /tmp/instructors-sync.json ${remoteWeb}:/tmp/instructors-sync.json; sudo docker exec $remoteWeb npx tsx scripts/sync-instructors.ts import /tmp/instructors-sync.json"
if ($LASTEXITCODE -ne 0) { throw "Instructor import on VPS failed" }

Write-Host "Sync published events..."
$eventsFile = Join-Path $env:TEMP "events-sync.json"
$eventsUploads = Join-Path (Get-Location) "skiinstruct\public\uploads\events"
docker cp skiinstruct/scripts/sync-events.mjs "${container}:/app/scripts/sync-events.mjs"
docker exec -e DATABASE_URL=$LocalDbUrl $container sh -c "node scripts/sync-events.mjs export > /tmp/events-sync.json"
if ($LASTEXITCODE -eq 0) {
  docker cp "${container}:/tmp/events-sync.json" $eventsFile
  $evParsed = Get-Content $eventsFile -Raw | ConvertFrom-Json
  $evCount = @($evParsed).Count
  Write-Host "Found $evCount published events"
  if ($evCount -gt 0) {
    scp $eventsFile "${SshHost}:/tmp/events-sync.json"
    scp skiinstruct/scripts/sync-events.mjs "${SshHost}:/tmp/sync-events.mjs"
    if (Test-Path $eventsUploads) {
      ssh $SshHost "mkdir -p $RemoteDir/deploy/skiinstruct-uploads/events"
      $evPhotoCount = @(Get-ChildItem -Path $eventsUploads -File -Recurse -ErrorAction SilentlyContinue).Count
      Write-Host "Uploading event photos: $evPhotoCount"
      scp -r "$eventsUploads/*" "${SshHost}:${RemoteDir}/deploy/skiinstruct-uploads/events/"
    }
    ssh $SshHost "sudo docker cp /tmp/sync-events.mjs ${remoteWeb}:/app/scripts/sync-events.mjs; sudo docker cp /tmp/events-sync.json ${remoteWeb}:/tmp/events-sync.json; sudo docker exec $remoteWeb node scripts/sync-events.mjs import /tmp/events-sync.json"
    if ($LASTEXITCODE -ne 0) { throw "Events import on VPS failed" }
  }
} else {
  Write-Warning "Events export skipped (local export failed)"
}

Write-Host "Done. Check https://utrainer.ru/client (hard refresh)."
