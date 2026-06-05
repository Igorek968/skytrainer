# afterFileEdit: пометить, что меняли skiinstruct (для refresh на stop).
$ErrorActionPreference = "SilentlyContinue"
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try {
  $input = $raw | ConvertFrom-Json
} catch {
  exit 0
}

$path = $input.file_path
if (-not $path) { $path = $input.path }
if (-not $path) { $path = $input.filePath }
if (-not $path) { exit 0 }

$normalized = ($path -replace '\\', '/').ToLower()
if ($normalized -notmatch '(^|/)skiinstruct/') { exit 0 }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$marker = Join-Path $repoRoot '.cursor/.skiinstruct-dirty'
New-Item -ItemType File -Force -Path $marker | Out-Null

# Авто-refresh на :3001 через 8 с после последней правки (debounce).
$debounceUntil = Join-Path $repoRoot '.cursor/.skiinstruct-debounce-until'
$runnerLock = Join-Path $repoRoot '.cursor/.skiinstruct-debounce-runner.lock'
$debouncedRunner = Join-Path $repoRoot '.cursor/hooks/run-debounced-skiinstruct-refresh.ps1'
$until = (Get-Date).AddSeconds(8).ToString('o')
Set-Content -Path $debounceUntil -Value $until -NoNewline

if (-not (Test-Path $runnerLock)) {
  New-Item -ItemType File -Force -Path $runnerLock | Out-Null
  Start-Process powershell -WindowStyle Hidden -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $debouncedRunner
  ) | Out-Null
}

exit 0
