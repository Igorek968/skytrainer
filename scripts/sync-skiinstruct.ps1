# Prod-сборка skiinstruct на http://localhost:3001 (медленно; для dev используйте refresh-skiinstruct-3001.ps1).
# Запуск из корня: .\scripts\sync-skiinstruct.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:SKIINSTRUCT_NEXT_MODE = "prod"
$env:SKIINSTRUCT_FORCE_REBUILD = "1"
$env:SKIINSTRUCT_NODE_ENV = "production"

Write-Host "Пересборка skiinstruct (prod) на :3001..."
docker compose up -d --force-recreate skiinstruct

Write-Host ""
Write-Host "Сборка идёт в контейнере. Логи:"
Write-Host "  docker compose logs -f skiinstruct"
Write-Host ""
Write-Host "Готово, когда в логах: [entry] prod: next start :3000"
Write-Host "Для обычной разработки: .\scripts\use-skiinstruct-dev-3001.ps1 или .\scripts\refresh-skiinstruct-3001.ps1"
