# Быстрый режим TvoyTrener.rf (next start). Запуск из корня репозитория.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:SKIINSTRUCT_NEXT_MODE = "prod"
$env:SKIINSTRUCT_FORCE_REBUILD = "1"
$env:SKIINSTRUCT_NODE_ENV = "production"

Write-Host "Удаляем старый dev-кэш .next..."
docker volume rm skytrainer_skiinstruct_next_cache 2>$null

Write-Host "Пересоздаём контейнер (первая сборка 5–15 мин)..."
docker compose up -d --build --force-recreate skiinstruct

Write-Host "Логи (Ctrl+C чтобы выйти, контейнер останется работать):"
docker compose logs -f skiinstruct
