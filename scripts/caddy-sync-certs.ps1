# Sync Caddy TLS data (deploy/caddy-data) between VPS and local repo.
param(
  [string]$SshHost = "vps",
  [string]$RemoteDir = "/opt/skytrainer",
  [ValidateSet("Pull", "Push", "Both")]
  [string]$Direction = "Pull"
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot ".."
$dataLocal = Join-Path $root "deploy\caddy-data"
$configLocal = Join-Path $root "deploy\caddy-config"
$remoteData = "$RemoteDir/deploy/caddy-data"
$remoteConfig = "$RemoteDir/deploy/caddy-config"

New-Item -ItemType Directory -Force -Path $dataLocal, $configLocal | Out-Null

function Sync-Dir([string]$Local, [string]$Remote) {
  if ($Direction -eq "Pull" -or $Direction -eq "Both") {
    Write-Host "Pull: $Remote -> $Local"
    ssh $SshHost "mkdir -p $Remote"
    scp -r "${SshHost}:${Remote}/" $Local
  }
  if ($Direction -eq "Push" -or $Direction -eq "Both") {
    $hasFiles = @(Get-ChildItem $Local -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne ".gitkeep" }).Count -gt 0
    if (-not $hasFiles) {
      Write-Host "Skip push $Local (empty). Issue cert on server first or run -Direction Pull."
      return
    }
    Write-Host "Push: $Local -> $Remote"
    ssh $SshHost "mkdir -p $Remote"
    scp -r "$Local/*" "${SshHost}:${Remote}/"
  }
}

Sync-Dir $dataLocal $remoteData
Sync-Dir $configLocal $remoteConfig
Write-Host "Done: $Direction"
