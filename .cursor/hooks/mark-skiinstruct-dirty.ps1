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
exit 0
