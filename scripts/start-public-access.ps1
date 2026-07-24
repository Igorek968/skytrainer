# Публичный HTTPS-доступ к локальному skiinstruct с любого телефона.
# Быстрый режим (без настройки DNS): случайный *.trycloudflare.com
# Постоянный домен: CLOUDFLARE_TUNNEL_TOKEN в .env + reg.ru CNAME (см. setup-tvoytrener-public.ps1)
param(
  [switch]$NamedOnly
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$repoRoot = (Get-Location).Path
$envFile = Join-Path $repoRoot ".env"
$tunnelUrlFile = Join-Path $repoRoot ".cursor/public-tunnel-url.txt"

function Read-DotEnvValue([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return $null }
  $line = Select-String -Path $path -Pattern "^\s*$([regex]::Escape($key))=(.+)$" |
    Select-Object -Last 1
  if ($line -and $line.Line -match "^\s*$([regex]::Escape($key))=(.+)$") {
    return $Matches[1].Trim().Trim('"')
  }
  return $null
}

function Wait-TunnelUrl([int]$timeoutSec = 90) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    # Only current container logs (not previous runs) — take the LAST URL match
    $logs = docker logs --since 3m skytrainer-tunnel-quick 2>$null | Out-String
    $matches = [regex]::Matches($logs, "https://[a-z0-9-]+\.trycloudflare\.com")
    if ($matches.Count -gt 0) {
      return $matches[$matches.Count - 1].Value
    }
    Start-Sleep -Seconds 2
  }
  return $null
}

function Update-AllowedOrigins([string]$hostName) {
  if (-not $hostName) { return }
  $current = Read-DotEnvValue $envFile "SKIINSTRUCT_SERVER_ACTIONS_ALLOWED_ORIGINS"
  $parts = @()
  if ($current) {
    $parts = $current.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  }
  if ($parts -notcontains $hostName) {
    $parts += $hostName
  }
  $merged = ($parts | Select-Object -Unique) -join ","
  if ($current -eq $merged) { return }

  $lines = if (Test-Path $envFile) { Get-Content $envFile } else { @() }
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^\s*SKIINSTRUCT_SERVER_ACTIONS_ALLOWED_ORIGINS=") {
      $found = $true
      "SKIINSTRUCT_SERVER_ACTIONS_ALLOWED_ORIGINS=$merged"
    } else {
      $line
    }
  }
  if (-not $found) {
    $out += "SKIINSTRUCT_SERVER_ACTIONS_ALLOWED_ORIGINS=$merged"
  }
  Set-Content -Path $envFile -Value $out -Encoding UTF8
  Write-Host "Updated SKIINSTRUCT_SERVER_ACTIONS_ALLOWED_ORIGINS (+$hostName)"
  Write-Host "Note: prod Server Actions need rebuild to pick up new host (optional for browsing)."
}

Write-Host "Starting local stack (postgres + skiinstruct + caddy)..."
docker compose up -d postgres skiinstruct caddy | Out-Host

$tunnelToken = Read-DotEnvValue $envFile "CLOUDFLARE_TUNNEL_TOKEN"
if ($tunnelToken) {
  Write-Host ""
  Write-Host "Named Cloudflare tunnel (tvoytrener.rf)..."
  docker compose --profile tunnel-named up -d cloudflared | Out-Host
  Write-Host "Tunnel running. Open: https://xn--b1agaovdpdkd.xn--p1ai (after DNS CNAME in reg.ru)"
  if (-not $NamedOnly) {
    Write-Host "Also starting quick tunnel for immediate test URL..."
  } else {
    exit 0
  }
}

Write-Host ""
Write-Host "Quick public tunnel (*.trycloudflare.com)..."
docker compose --profile tunnel up -d cloudflared-quick | Out-Host

$url = Wait-TunnelUrl
if (-not $url) {
  Write-Host "Tunnel URL not found yet. Check logs:"
  Write-Host "  docker compose logs -f cloudflared-quick"
  exit 1
}

try {
  $hostName = ([uri]$url).Host
  Update-AllowedOrigins $hostName
} catch {
  Write-Host "Could not update allowed origins: $_"
}

New-Item -ItemType Directory -Force -Path (Split-Path $tunnelUrlFile) | Out-Null
Set-Content -Path $tunnelUrlFile -Value $url -Encoding UTF8

Write-Host ""
Write-Host "Public URL (open on any phone):"
Write-Host "  $url"
Write-Host ""
Write-Host "Saved to: $tunnelUrlFile"
Write-Host "Logs: docker compose logs -f cloudflared-quick"
