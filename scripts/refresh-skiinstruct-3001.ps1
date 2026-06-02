# Apply skiinstruct changes to http://localhost:3001
# Run from repo root: .\scripts\refresh-skiinstruct-3001.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Get-SkiinstructMode {
  if ($env:SKIINSTRUCT_NEXT_MODE) {
    return $env:SKIINSTRUCT_NEXT_MODE.Trim().ToLower()
  }
  $envFile = Join-Path $PSScriptRoot "..\.env"
  if (Test-Path $envFile) {
    $fromFile = Select-String -Path $envFile -Pattern "^SKIINSTRUCT_NEXT_MODE=(.+)$" |
      Select-Object -Last 1
    if ($fromFile -and $fromFile.Line -match "^SKIINSTRUCT_NEXT_MODE=(.+)$") {
      return $Matches[1].Trim().ToLower()
    }
  }
  $line = docker inspect skiinstruct-web --format "{{range .Config.Env}}{{println .}}{{end}}" 2>$null |
    Where-Object { $_ -match "^SKIINSTRUCT_NEXT_MODE=(.+)$" } |
    Select-Object -First 1
  if ($line -match "^SKIINSTRUCT_NEXT_MODE=(.+)$") {
    return $Matches[1].Trim().ToLower()
  }
  return "prod"
}

$mode = Get-SkiinstructMode
Write-Host "SkiInstruct refresh (mode=$mode) -> http://localhost:3001 ..."

if ($mode -eq "dev") {
  if (-not $env:SKIINSTRUCT_NEXT_MODE) {
    $env:SKIINSTRUCT_NEXT_MODE = "dev"
  }
  docker compose up -d skiinstruct | Out-Host
  Write-Host ""
  Write-Host "Dev: edit skiinstruct/src, then hard-refresh the browser (Ctrl+F5)."
  Write-Host "Logs: docker compose logs -f skiinstruct"
  Write-Host "Ready when log shows: Ready (next dev)"
  exit 0
}

if (-not $env:SKIINSTRUCT_NEXT_MODE) {
  $env:SKIINSTRUCT_NEXT_MODE = "prod"
}
if (-not $env:SKIINSTRUCT_FORCE_REBUILD) {
  $env:SKIINSTRUCT_FORCE_REBUILD = "0"
}
$env:SKIINSTRUCT_NODE_ENV = "production"
docker compose up -d skiinstruct | Out-Host
Write-Host ""
if ($env:SKIINSTRUCT_FORCE_REBUILD -eq "1") {
  Write-Host "Prod: полная пересборка. Logs: docker compose logs -f skiinstruct"
} else {
  Write-Host "Prod: перезапуск (сборка только если менялся src/). Logs: docker compose logs -f skiinstruct"
}
Write-Host "Ready when log shows: [entry] prod: next start :3000"
