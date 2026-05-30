# Синхронизация правок skiinstruct с http://localhost:3001
# Контейнер в prod-режиме (next start) — после изменений src/ нужен rebuild.
# Запуск из корня репозитория: .\scripts\sync-skiinstruct.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:SKIINSTRUCT_NEXT_MODE = "prod"
$env:SKIINSTRUCT_FORCE_REBUILD = "1"
$env:SKIINSTRUCT_NODE_ENV = "production"

Write-Host "Пересборка skiinstruct и перезапуск на :3001..."
docker compose up -d --force-recreate skiinstruct

Write-Host ""
Write-Host "Сборка идёт в контейнере. Логи:"
Write-Host "  docker compose logs -f skiinstruct"
Write-Host ""
Write-Host "Готово, когда в логах: [entry] prod: next start :3000"
