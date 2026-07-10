# Pull live instructor profiles FROM VPS into local DB (reverse of sync-instructors-to-vps.ps1).
param(
  [string]$SshHost = "vps",
  [string]$RemoteDir = "/opt/skytrainer",
  [string]$LocalDbUrl = "postgres://sky:sky@postgres:5432/skytrainer_new?schema=skiinstruct",
  [string]$RemoteContainer = "skiinstruct-qa-web"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$exportFile = Join-Path $env:TEMP "instructors-from-vps.json"
$uploadsDir = Join-Path (Get-Location) "skiinstruct\public\uploads\instructors"

Write-Host "Export instructors from VPS ($SshHost)..."
scp skiinstruct/scripts/sync-instructors.ts "${SshHost}:/tmp/sync-instructors.ts"
ssh $SshHost "docker cp /tmp/sync-instructors.ts ${RemoteContainer}:/app/scripts/sync-instructors.ts; docker exec ${RemoteContainer} npx tsx scripts/sync-instructors.ts export > /tmp/instructors-from-vps.json"
if ($LASTEXITCODE -ne 0) { throw "Remote export failed (SSH/VPS/container?)" }

scp "${SshHost}:/tmp/instructors-from-vps.json" $exportFile

$parsed = Get-Content $exportFile -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host ("Found {0} instructor(s) on VPS:" -f $parsed.Count)
foreach ($row in $parsed) {
  Write-Host ("  - {0} <{1}>" -f $row.name, $row.email)
}

Write-Host "Download instructor photos from VPS..."
ssh $SshHost "test -d ${RemoteDir}/deploy/skiinstruct-uploads/instructors && tar czf /tmp/instructor-uploads.tgz -C ${RemoteDir}/deploy/skiinstruct-uploads instructors || true"
$remoteTar = Join-Path $env:TEMP "instructor-uploads-from-vps.tgz"
scp "${SshHost}:/tmp/instructor-uploads.tgz" $remoteTar -ErrorAction SilentlyContinue
if (Test-Path $remoteTar) {
  New-Item -ItemType Directory -Force -Path $uploadsDir | Out-Null
  tar xzf $remoteTar -C (Join-Path (Get-Location) "skiinstruct\public\uploads") 2>$null
  Write-Host "Photos extracted to skiinstruct/public/uploads/instructors/"
}

Write-Host "Import into local DB..."
docker cp skiinstruct/scripts/sync-instructors.ts skiinstruct-web:/app/scripts/sync-instructors.ts
docker cp $exportFile skiinstruct-web:/tmp/instructors-from-vps.json
docker exec -e DATABASE_URL=$LocalDbUrl skiinstruct-web sh -c "npx tsx scripts/sync-instructors.ts import /tmp/instructors-from-vps.json"
if ($LASTEXITCODE -ne 0) { throw "Local import failed" }

Write-Host ""
Write-Host "Done. Refresh http://localhost:3001/client or http://твойтренер.рф/client"
Write-Host "Then run: .\scripts\refresh-skiinstruct-3001.ps1"
