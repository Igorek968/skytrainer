# stop: применить правки skiinstruct на localhost:3001, если были правки в этой сессии.
$ErrorActionPreference = "SilentlyContinue"
[void][Console]::In.ReadToEnd()

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$marker = Join-Path $repoRoot '.cursor/.skiinstruct-dirty'
if (-not (Test-Path $marker)) { exit 0 }

Remove-Item $marker -Force -ErrorAction SilentlyContinue

$refresh = Join-Path $repoRoot 'scripts/refresh-skiinstruct-3001.ps1'
if (-not (Test-Path $refresh)) { exit 0 }

Set-Location $repoRoot
& powershell -NoProfile -ExecutionPolicy Bypass -File $refresh
exit 0
