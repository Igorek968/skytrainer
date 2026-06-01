# Применить правки skiinstruct на http://localhost:3001
# dev  = next dev (hot-reload, перезапуск контейнера)
# prod = next build + start (пересоздание контейнера)
# Запуск из корня: .\scripts\refresh-skiinstruct-3001.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Get-SkiinstructMode {
  if ($env:SKIINSTRUCT_NEXT_MODE) {
    return $env:SKIINSTRUCT_NEXT_MODE.Trim().ToLower()
  }
  $line = docker inspect skiinstruct-web --format "{{range .Config.Env}}{{println .}}{{end}}" 2>$null |
    Where-Object { $_ -match "^SKIINSTRUCT_NEXT_MODE=(.+)$" } |
    Select-Object -First 1
  if ($line -match "^SKIINSTRUCT_NEXT_MODE=(.+)$") {
    return $Matches[1].Trim().ToLower()
  }
  return "dev"
}

$mode = Get-SkiinstructMode
Write-Host "SkiInstruct refresh (mode=$mode) для http://localhost:3001 ..."

if ($mode -eq "dev") {
  docker compose restart skiinstruct | Out-Host
  Write-Host ""
  Write-Host "Dev: edits in skiinstruct/src hot-reload; refresh browser in 5-30s."
  Write-Host "Логи: docker compose logs -f skiinstruct"
  Write-Host "Готово, когда в логах: [entry] dev или 'Ready' / 'compiled'"
  exit 0
}

$env:SKIINSTRUCT_NEXT_MODE = "prod"
$env:SKIINSTRUCT_FORCE_REBUILD = "1"
$env:SKIINSTRUCT_NODE_ENV = "production"
docker compose up -d --force-recreate skiinstruct | Out-Host
Write-Host ""
Write-Host "Prod: сборка в контейнере. Логи: docker compose logs -f skiinstruct"
Write-Host "Готово, когда: [entry] prod: next start :3000"
