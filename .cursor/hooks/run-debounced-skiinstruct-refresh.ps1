# Ждёт debounce и запускает refresh-skiinstruct-3001.ps1 (вызывается из mark-skiinstruct-dirty).
$ErrorActionPreference = "SilentlyContinue"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$debounceUntil = Join-Path $repoRoot ".cursor/.skiinstruct-debounce-until"
$runnerLock = Join-Path $repoRoot ".cursor/.skiinstruct-debounce-runner.lock"
$refresh = Join-Path $repoRoot "scripts/refresh-skiinstruct-3001.ps1"

try {
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 2
    if (-not (Test-Path $debounceUntil)) { exit 0 }
    $raw = (Get-Content $debounceUntil -Raw -ErrorAction SilentlyContinue).Trim()
    if (-not $raw) { exit 0 }
    try {
      $target = [DateTime]::Parse($raw)
    } catch {
      exit 0
    }
    if ((Get-Date) -lt $target) { continue }

    Remove-Item $debounceUntil -Force -ErrorAction SilentlyContinue
    if (Test-Path $refresh) {
      Set-Location $repoRoot
      & powershell -NoProfile -ExecutionPolicy Bypass -File $refresh
    }
    exit 0
  }
} finally {
  Remove-Item $runnerLock -Force -ErrorAction SilentlyContinue
}
