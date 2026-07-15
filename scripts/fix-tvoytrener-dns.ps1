# Fix tvoytrener.rf DNS at reg.ru: point A records to current VPS IP.
# Requires in .env:
#   REG_RU_USERNAME=your_login
#   REG_RU_PASSWORD=API_password_from_reg.ru_settings
#   TVOYTRENER_VPS_IP=93.77.189.27
param(
  [string]$VpsIp = "",
  [string]$RegRuUser = "",
  [string]$RegRuPassword = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$envFile = Join-Path (Get-Location) ".env"
$domainPuny = "xn--b1agaovdpdkd.xn--p1ai"
$wrongIp = "93.77.189.9"
$defaultVpsIp = "93.77.189.27"

function Read-DotEnvValue([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return $null }
  $line = Select-String -Path $path -Pattern "^\s*$([regex]::Escape($key))=(.+)$" | Select-Object -Last 1
  if ($line -and $line.Line -match "^\s*$([regex]::Escape($key))=(.+)$") {
    return $Matches[1].Trim().Trim('"')
  }
  return $null
}

if (-not $VpsIp) { $VpsIp = Read-DotEnvValue $envFile "TVOYTRENER_VPS_IP" }
if (-not $VpsIp) { $VpsIp = $defaultVpsIp }
if (-not $RegRuUser) { $RegRuUser = Read-DotEnvValue $envFile "REG_RU_USERNAME" }
if (-not $RegRuPassword) { $RegRuPassword = Read-DotEnvValue $envFile "REG_RU_PASSWORD" }

if (-not $RegRuUser -or -not $RegRuPassword) {
  Write-Host "Missing REG_RU_USERNAME / REG_RU_PASSWORD in .env"
  Write-Host ""
  Write-Host "Manual fix at https://www.reg.ru/user/account/#/card/$domainPuny/dns/"
  Write-Host "  1. Delete A record -> $wrongIp"
  Write-Host "  2. Add A @ -> $VpsIp"
  Write-Host "  3. Add A www -> $VpsIp"
  Write-Host ""
  Write-Host "API password: reg.ru -> Settings -> API -> generate alternative password"
  exit 1
}

$payload = @{
  username = $RegRuUser
  password = $RegRuPassword
  domains  = @(
    @{
      dname        = $domainPuny
      action_list  = @(
        @{
          action      = "remove_record"
          subdomain   = "@"
          record_type = "A"
          content     = $wrongIp
        },
        @{
          action    = "add_alias"
          subdomain = "@"
          ipaddr    = $VpsIp
        },
        @{
          action    = "add_alias"
          subdomain = "www"
          ipaddr    = $VpsIp
        }
      )
    }
  )
  output_content_type = "plain"
}

$body = @{
  input_data   = ($payload | ConvertTo-Json -Depth 8 -Compress)
  input_format = "json"
}

Write-Host "Updating reg.ru DNS: $domainPuny -> $VpsIp ..."
$response = Invoke-RestMethod -Uri "https://api.reg.ru/api/regru2/zone/update_records" -Method Post -Body $body
$response | ConvertTo-Json -Depth 6
Write-Host ""
Write-Host "Done. Wait 5-30 min, then open: https://$domainPuny"
