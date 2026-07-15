# Point tvoytrener.rf to current VPS IP (bypass stale ISP DNS cache).
# Run from repo root (admin UAC prompt): .\scripts\point-tvoytrener-hosts-to-vps.ps1
param(
  [string]$VpsIp = "93.77.189.27"
)

$ErrorActionPreference = "Stop"
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$marker = "# skytrainer tvoytrener.rf"
$puny = "xn--b1agaovdpdkd.xn--p1ai"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
  Write-Host "Admin rights required. Relaunching elevated..."
  $self = $PSCommandPath
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$self`" -VpsIp $VpsIp" -Wait
  exit $LASTEXITCODE
}

$lines = @(Get-Content $hostsPath -ErrorAction SilentlyContinue)
$out = New-Object System.Collections.Generic.List[string]
$skipMarkerBlock = $false
foreach ($line in $lines) {
  if ($line -match [regex]::Escape($marker)) {
    $skipMarkerBlock = $true
    continue
  }
  if ($skipMarkerBlock) {
    if ($line -match [regex]::Escape($puny)) { continue }
    $skipMarkerBlock = $false
  }
  if ($line -match [regex]::Escape($puny)) { continue }
  $out.Add($line)
}

$out.Add($marker)
$out.Add("$VpsIp $puny")
$out.Add("$VpsIp www.$puny")

Set-Content -Path $hostsPath -Value $out -Encoding ASCII
ipconfig /flushdns | Out-Null
Write-Host "hosts: $puny -> $VpsIp"
Write-Host "Open: https://$puny"
