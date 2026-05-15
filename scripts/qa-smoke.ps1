param(
  [string]$Domain
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Domain)) {
  Write-Error "Usage: ./scripts/qa-smoke.ps1 -Domain qa.example.com"
}

$targets = @(
  "https://$Domain/",
  "https://$Domain/api/health",
  "https://$Domain/admin/login"
)

foreach ($url in $targets) {
  try {
    $response = Invoke-WebRequest -Uri $url -TimeoutSec 20
    Write-Output "$url -> $($response.StatusCode)"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if (-not $code) { $code = "ERR" }
    Write-Output "$url -> $code"
  }
}
