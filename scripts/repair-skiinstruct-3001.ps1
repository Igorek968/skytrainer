# Починка :3001: dev-режим + чистый кэш .next (если «Cannot find module ./NNNN.js» или белый экран).
# Запуск из корня: .\scripts\repair-skiinstruct-3001.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:SKIINSTRUCT_NEXT_MODE = "dev"
$env:SKIINSTRUCT_USE_POLLING = "true"
$env:SKIINSTRUCT_FORCE_REBUILD = "0"
Remove-Item Env:SKIINSTRUCT_NODE_ENV -ErrorAction SilentlyContinue

Write-Host "SkiInstruct repair: dev + чистый .next -> http://localhost:3001 ..."

docker compose stop skiinstruct | Out-Host
docker compose rm -sf skiinstruct | Out-Host
docker volume rm skytrainer_skiinstruct_next_cache 2>$null

docker compose up -d skiinstruct | Out-Host

Write-Host ""
Write-Host "Ждите в логах: Ready in ... (next dev)"
Write-Host "Логи: docker compose logs -f skiinstruct"
Write-Host "После Ready: http://localhost:3001/client (Ctrl+F5)"
