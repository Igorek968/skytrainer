# Ежедневный бэкап PostgreSQL (хранение 7 дней).
# Запуск: .\scripts\backup-postgres.ps1
# Планировщик Windows: ежедневно в 03:00.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$backupDir = Join-Path $repoRoot "backups\postgres"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$outFile = Join-Path $backupDir "skytrainer_$stamp.sql.gz"

Write-Host "[backup] $outFile"

docker compose exec -T postgres pg_dump -U sky -d skytrainer_new | gzip > $outFile

# Удалить архивы старше 7 дней
Get-ChildItem $backupDir -Filter "skytrainer_*.sql.gz" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
  ForEach-Object {
    Write-Host "[backup] remove old $($_.Name)"
    Remove-Item $_.FullName -Force
  }

Write-Host "[backup] done"
