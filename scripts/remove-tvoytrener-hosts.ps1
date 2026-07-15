# Remove local hosts override so tvoytrener.rf opens the real VPS (not localhost).
# Run from repo root: .\scripts\remove-tvoytrener-hosts.ps1

$ErrorActionPreference = "Stop"
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$marker = "# skytrainer tvoytrener.rf"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
  Write-Host "Admin rights required. Relaunching elevated..."
  $self = $PSCommandPath
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$self`"" -Wait
  exit $LASTEXITCODE
}

$lines = Get-Content $hostsPath
$out = New-Object System.Collections.Generic.List[string]
$skipMarkerBlock = $false
foreach ($line in $lines) {
  if ($line -match [regex]::Escape($marker)) {
    $skipMarkerBlock = $true
    continue
  }
  if ($skipMarkerBlock) {
    if ($line -match "xn--b1agaovdpdkd\.xn--p1ai") { continue }
    $skipMarkerBlock = $false
  }
  if ($line -match "xn--b1agaovdpdkd\.xn--p1ai") { continue }
  $out.Add($line)
}

Set-Content -Path $hostsPath -Value $out -Encoding ASCII
ipconfig /flushdns | Out-Null
Write-Host "Removed tvoytrener.rf from hosts. Domain now points to VPS 93.77.189.27"
Write-Host "Open: https://xn--b1agaovdpdkd.xn--p1ai"
