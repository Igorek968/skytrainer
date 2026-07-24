# Включить dev + hot-reload на :3001 (рекомендуется для локальной разработки).
# Запуск из корня: .\scripts\use-skiinstruct-dev-3001.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:SKIINSTRUCT_NEXT_MODE = "dev"
$env:SKIINSTRUCT_USE_POLLING = "true"
$env:SKIINSTRUCT_FORCE_REBUILD = "0"
Remove-Item Env:SKIINSTRUCT_NODE_ENV -ErrorAction SilentlyContinue

Write-Host "Переключение skiinstruct на dev (hot-reload) :3001 ..."

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  $content = Get-Content $envFile -Raw
  if ($content -match "(?m)^SKIINSTRUCT_NEXT_MODE=") {
    $content = $content -replace "(?m)^SKIINSTRUCT_NEXT_MODE=.*", "SKIINSTRUCT_NEXT_MODE=dev"
  } else {
    $content += "`nSKIINSTRUCT_NEXT_MODE=dev`n"
  }
  Set-Content -Path $envFile -Value $content -NoNewline
}

docker compose up -d --force-recreate skiinstruct

Write-Host ""
Write-Host "Логи: docker compose logs -f skiinstruct"
Write-Host "Done when logs show: Ready or compiled (next dev on port 3000 in container)"
