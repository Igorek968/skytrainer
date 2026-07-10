# Map tvoytrener.rf -> 127.0.0.1 in Windows hosts (admin required).
# Run from repo root: .\scripts\setup-tvoytrener-hosts.ps1

$ErrorActionPreference = "Stop"

$ip = "127.0.0.1"
$puny = "xn--b1agaovdpdkd.xn--p1ai"
$wwwPuny = "www.xn--b1agaovdpdkd.xn--p1ai"
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$marker = "# skytrainer tvoytrener.rf"

$entries = @(
  "$ip`t$puny`t$marker",
  "$ip`t$wwwPuny`t$marker"
)

function Test-HostsEntry([string]$hostPart) {
  $pattern = [regex]::Escape($hostPart)
  Select-String -Path $hostsPath -Pattern $pattern -Quiet
}

$missing = @()
foreach ($e in $entries) {
  $hostPart = $e.Split("`t")[1]
  if (-not (Test-HostsEntry $hostPart)) { $missing += $e }
}

if ($missing.Count -eq 0) {
  Write-Host "Hosts OK: $puny -> $ip"
  exit 0
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
  Write-Host "Admin rights required. Relaunching elevated..."
  $self = $PSCommandPath
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$self`"" -Wait
  exit $LASTEXITCODE
}

Add-Content -Path $hostsPath -Value ""
Add-Content -Path $hostsPath -Value $marker
foreach ($e in $missing) {
  Add-Content -Path $hostsPath -Value $e
  Write-Host "Added: $e"
}

Write-Host ""
Write-Host "Done. Open: http://$puny (browser shows tvoytrener.rf)"
