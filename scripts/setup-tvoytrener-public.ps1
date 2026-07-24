# Постоянный публичный доступ: https://твойтренер.рф через Cloudflare Tunnel + reg.ru DNS.
# Запуск из корня: .\scripts\setup-tvoytrener-public.ps1
param(
  [string]$TunnelToken = "",
  [string]$RegRuUser = "",
  [string]$RegRuPassword = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$repoRoot = (Get-Location).Path
$envFile = Join-Path $repoRoot ".env"
$domainPuny = "xn--b1agaovdpdkd.xn--p1ai"
$domainDisplay = "твойтренер.рф"

function Read-DotEnvValue([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return $null }
  $line = Select-String -Path $path -Pattern "^\s*$([regex]::Escape($key))=(.+)$" |
    Select-Object -Last 1
  if ($line -and $line.Line -match "^\s*$([regex]::Escape($key))=(.+)$") {
    return $Matches[1].Trim().Trim('"')
  }
  return $null
}

function Set-DotEnvValue([string]$path, [string]$key, [string]$value) {
  $lines = if (Test-Path $path) { Get-Content $path } else { @() }
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^\s*$([regex]::Escape($key))=") {
      $found = $true
      "$key=$value"
    } else {
      $line
    }
  }
  if (-not $found) { $out += "$key=$value" }
  Set-Content -Path $path -Value $out -Encoding UTF8
}

if (-not $TunnelToken) {
  $TunnelToken = Read-DotEnvValue $envFile "CLOUDFLARE_TUNNEL_TOKEN"
}
if (-not $RegRuUser) {
  $RegRuUser = Read-DotEnvValue $envFile "REG_RU_USERNAME"
}
if (-not $RegRuPassword) {
  $RegRuPassword = Read-DotEnvValue $envFile "REG_RU_PASSWORD"
}

Write-Host "=== $domainDisplay — публичный доступ ==="
Write-Host ""

if (-not $TunnelToken) {
  Write-Host "1) Cloudflare Zero Trust (один раз, ~2 мин):"
  Write-Host "   https://one.dash.cloudflare.com/"
  Write-Host "   Networks -> Tunnels -> Create tunnel -> Cloudflared"
  Write-Host "   Public Hostname:"
  Write-Host "     Subdomain: (пусто)  Domain: $domainPuny"
  Write-Host "     Service: HTTP  skiinstruct:3000"
  Write-Host "   Скопируйте Install command -> token (длинная строка после --token)"
  Write-Host ""
  Write-Host "2) Добавьте в .env:"
  Write-Host "   CLOUDFLARE_TUNNEL_TOKEN=<token>"
  Write-Host ""
  Write-Host "3) Запустите снова: .\scripts\setup-tvoytrener-public.ps1"
  Write-Host ""
  Write-Host "Пока токена нет — быстрый доступ с телефона:"
  Write-Host "   .\scripts\start-public-access.ps1"
  exit 0
}

Set-DotEnvValue $envFile "CLOUDFLARE_TUNNEL_TOKEN" $TunnelToken
Set-DotEnvValue $envFile "SKIINSTRUCT_AUTH_URL" "https://$domainDisplay"
Set-DotEnvValue $envFile "SKIINSTRUCT_PUBLIC_APP_URL" "https://$domainDisplay"
Set-DotEnvValue $envFile "NEXT_PUBLIC_APP_URL" "https://$domainDisplay"
Set-DotEnvValue $envFile "SKIINSTRUCT_SERVER_ACTIONS_ALLOWED_ORIGINS" "$domainDisplay,www.$domainDisplay,$domainPuny,www.$domainPuny"

Write-Host "Updated .env for https://$domainDisplay"
Write-Host "Starting stack + named tunnel..."
docker compose up -d postgres skiinstruct caddy | Out-Null
docker compose --profile tunnel-named up -d cloudflared | Out-Host

if ($RegRuUser -and $RegRuPassword) {
  Write-Host ""
  Write-Host "Updating reg.ru DNS (remove wrong A, add CNAME for tunnel)..."
  Write-Host "NOTE: CNAME target is shown in Cloudflare tunnel Public Hostname page."
  Write-Host "      Usually: <tunnel-id>.cfargotunnel.com"
  Write-Host ""
  Write-Host "If tunnel already has Public Hostname in Cloudflare dashboard,"
  Write-Host "DNS is often managed by Cloudflare automatically when domain is on CF."
  Write-Host "For reg.ru NS only: add CNAME @ -> <tunnel-id>.cfargotunnel.com manually"
  Write-Host "or use reg.ru panel: DNS -> delete A 93.77.189.9 -> add A 93.77.189.27."
} else {
  Write-Host ""
  Write-Host "reg.ru DNS (обязательно для телефона по домену $domainDisplay):"
  Write-Host "  1. reg.ru -> Домены -> $domainDisplay -> DNS-серверы и зона"
  Write-Host "  2. Удалите A-запись 93.77.189.9"
  Write-Host "  3. Добавьте A @ -> 93.77.189.27 и A www -> 93.77.189.27"
  Write-Host ""
  Write-Host "Для автоматизации через API добавьте в .env:"
  Write-Host "  REG_RU_USERNAME=..."
  Write-Host "  REG_RU_PASSWORD=...  # пароль для API (не основной), reg.ru -> Настройки API"
}

Write-Host ""
Write-Host "After DNS propagates: https://$domainDisplay"
Write-Host "Check: docker compose logs -f cloudflared"
