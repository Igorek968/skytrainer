# Быстрый SkiInstruct на :3001 (next start). Для разработки UI — npm run dev в skiinstruct/ без Docker.
# Запуск из корня: .\scripts\use-skiinstruct-prod-3001.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:SKIINSTRUCT_NEXT_MODE = "prod"
$env:SKIINSTRUCT_USE_POLLING = "false"
$env:SKIINSTRUCT_FORCE_REBUILD = "0"
$env:SKIINSTRUCT_NODE_ENV = "production"
Remove-Item Env:SKIINSTRUCT_USE_POLLING -ErrorAction SilentlyContinue

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  $lines = Get-Content $envFile -Raw
  if ($lines -match "(?m)^SKIINSTRUCT_NEXT_MODE=.*$") {
    $lines = $lines -replace "(?m)^SKIINSTRUCT_NEXT_MODE=.*$", "SKIINSTRUCT_NEXT_MODE=prod"
  } else {
    $lines = $lines.TrimEnd() + "`nSKIINSTRUCT_NEXT_MODE=prod`n"
  }
  if ($lines -match "(?m)^SKIINSTRUCT_USE_POLLING=.*$") {
    $lines = $lines -replace "(?m)^SKIINSTRUCT_USE_POLLING=.*$", "SKIINSTRUCT_USE_POLLING=false"
  } else {
    $lines = $lines.TrimEnd() + "`nSKIINSTRUCT_USE_POLLING=false`n"
  }
  Set-Content -Path $envFile -Value $lines.TrimEnd() -NoNewline
  Add-Content -Path $envFile -Value ""
}

Write-Host "SkiInstruct -> prod (fast next start) on http://localhost:3001 ..."
docker compose up -d --force-recreate skiinstruct | Out-Host
Write-Host ""
Write-Host "First time or after code changes: build 5-15 min. Logs:"
Write-Host "  docker compose logs -f skiinstruct"
Write-Host "Ready when: [entry] prod: next start :3000"
Write-Host ""
Write-Host "Rebuild after edits: docker compose exec skiinstruct npm run build; docker compose restart skiinstruct"
