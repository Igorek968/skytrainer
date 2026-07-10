# Full go-live: VPS deploy + reg.ru DNS, or public tunnel fallback.
param(
  [switch]$TunnelOnly,
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$vpsIp = "93.77.189.9"
$domain = "xn--b1agaovdpdkd.xn--p1ai"

Write-Host "=== Go live: tvoytrener.rf ==="

if (-not $TunnelOnly -and -not $SkipDeploy) {
  Write-Host ""
  Write-Host "[1/3] Deploy to VPS ($vpsIp)..."
  $sshOk = $false
  try {
    ssh -o ConnectTimeout=12 -o BatchMode=yes vps "echo ok" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $sshOk = $true }
  } catch {}

  if ($sshOk) {
    & (Join-Path $PSScriptRoot "deploy-vps.ps1")
    Write-Host "VPS deploy done."
  } else {
    Write-Host "VPS unreachable (SSH timeout). Start server in hosting panel (Beget?), then re-run."
  }
}

if (-not $TunnelOnly) {
  Write-Host ""
  Write-Host "[2/3] DNS at reg.ru -> $vpsIp ..."
  & (Join-Path $PSScriptRoot "fix-tvoytrener-dns.ps1") -VpsIp $vpsIp
}

Write-Host ""
Write-Host "[3/3] Public tunnel (works from any phone while PC + Docker are on)..."
& (Join-Path $PSScriptRoot "start-public-access.ps1")

Write-Host ""
Write-Host "Permanent domain: https://$domain (after VPS is up + DNS fixed)"
$urlFile = Join-Path (Get-Location) ".cursor/public-tunnel-url.txt"
if (Test-Path $urlFile) {
  Write-Host "Temporary URL: $(Get-Content $urlFile -Raw)"
}
