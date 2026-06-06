# Регистрация cron-задач Windows для skiinstruct (на VPS — crontab, см. skiinstruct/docs/CRON.md).
# Требует SKIINSTRUCT_CRON_SECRET и SKIINSTRUCT_PUBLIC_APP_URL в .env.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env"

if (-not (Test-Path $envFile)) {
  Write-Error ".env not found at $envFile"
}

$envContent = Get-Content $envFile -Raw
$cronSecret = if ($envContent -match 'SKIINSTRUCT_CRON_SECRET=(.+)') { $Matches[1].Trim() } else { $null }
$appUrl = if ($envContent -match 'SKIINSTRUCT_PUBLIC_APP_URL=(.+)') { $Matches[1].Trim() } else { "http://localhost:3001" }

if (-not $cronSecret -or $cronSecret -match 'replace-with') {
  Write-Error "Set SKIINSTRUCT_CRON_SECRET in .env"
}

$taskPrefix = "SkytrainerCron"
$ps1 = Join-Path $repoRoot "scripts\invoke-cron-endpoint.ps1"
@'
param([string]$Url, [string]$Secret)
Invoke-RestMethod -Uri "$Url`?secret=$Secret" -Method GET -TimeoutSec 120 | Out-Null
'@ | Set-Content -Path $ps1 -Encoding UTF8

function Register-CronTask($name, $intervalMinutes, $path) {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ps1`" -Url `"$appUrl$path`" -Secret `"$cronSecret`""
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $intervalMinutes) -RepetitionDuration ([TimeSpan]::MaxValue)
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  Register-ScheduledTask -TaskName "$taskPrefix-$name" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Host "Registered $taskPrefix-$name every $intervalMinutes min -> $path"
}

Register-CronTask "expire-orders" 5 "/api/cron/expire-orders"
Register-CronTask "lesson-reminders" 1 "/api/cron/lesson-reminders"
Register-CronTask "expire-events" 60 "/api/cron/expire-events"

Write-Host "Cron tasks registered. Check: Get-ScheduledTask -TaskName '$taskPrefix-*'"
