# Apply skiinstruct changes to http://localhost:3001
# Run from repo root: .\scripts\refresh-skiinstruct-3001.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$repoRoot = (Get-Location).Path
$lockPath = Join-Path $repoRoot ".cursor/.skiinstruct-refresh.lock"
if (Test-Path $lockPath) {
  $age = (Get-Date) - (Get-Item $lockPath).LastWriteTime
  if ($age.TotalMinutes -lt 25) {
    Write-Host "Refresh in progress ($([int]$age.TotalSeconds)s). Logs: docker compose logs -f skiinstruct"
    exit 0
  }
  Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType File -Force -Path $lockPath | Out-Null

try {
  function Get-SkiinstructMode {
    if ($env:SKIINSTRUCT_NEXT_MODE) {
      return $env:SKIINSTRUCT_NEXT_MODE.Trim().ToLower()
    }
    $envFile = Join-Path $repoRoot ".env"
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
  Write-Host "TvoyTrener.rf refresh (mode=$mode) -> http://localhost:3001 ..."

  $dirtyMarker = Join-Path $repoRoot ".cursor/.skiinstruct-dirty"
  $hadEdits = Test-Path $dirtyMarker
  if ($hadEdits) {
    Remove-Item $dirtyMarker -Force -ErrorAction SilentlyContinue
  }

  if ($mode -eq "dev") {
    if (-not $env:SKIINSTRUCT_NEXT_MODE) {
      $env:SKIINSTRUCT_NEXT_MODE = "dev"
    }
    docker compose up -d skiinstruct | Out-Host
    docker compose restart skiinstruct | Out-Host
    Write-Host ""
    Write-Host "Dev: hot-reload on skiinstruct/src (hard refresh Ctrl+F5)."
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
  if ($hadEdits) {
    $env:SKIINSTRUCT_FORCE_REBUILD = "1"
  }
  $env:SKIINSTRUCT_NODE_ENV = "production"

  docker compose up -d skiinstruct | Out-Host
  Write-Host "Clear src build marker, then restart..."
  docker compose exec -T skiinstruct sh -c "rm -f /app/.next/.skiinstruct-src-hash" 2>$null | Out-Null
  docker compose restart skiinstruct | Out-Host

  Write-Host ""
  Write-Host "Prod: rebuild on restart. Logs: docker compose logs -f skiinstruct"
  Write-Host "Ready when log shows: [entry] prod: next start :3000"
} finally {
  Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}
