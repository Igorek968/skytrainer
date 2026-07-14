# Sync SEO essentials to Yandex Webmaster API.
# Requires YANDEX_WEBMASTER_TOKEN in repo root .env
param(
  [string]$Token = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Read-DotEnv([string]$key) {
  $line = Get-Content .env -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return $line.Substring($key.Length + 1).Trim()
}

if (-not $Token) { $Token = Read-DotEnv "YANDEX_WEBMASTER_TOKEN" }
if (-not $Token) { throw "Set YANDEX_WEBMASTER_TOKEN in .env" }

$headers = @{
  Authorization = "OAuth $Token"
  Accept        = "application/json"
  "Content-Type" = "application/json"
}

$user = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user" -Headers $headers
$uid = $user.user_id
Write-Host "user_id=$uid"

$hosts = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts" -Headers $headers
foreach ($h in $hosts.hosts) {
  Write-Host ("host {0} verified={1}" -f $h.host_id, $h.verified)
}

# Prefer http host already verified (API host_id format)
$httpHost = $hosts.hosts | Where-Object { $_.host_id -like "http:xn--b1agaovdpdkd*" } | Select-Object -First 1
if (-not $httpHost) { $httpHost = $hosts.hosts | Select-Object -First 1 }
if (-not $httpHost) { throw "No hosts in Webmaster" }

$hostId = $httpHost.host_id
Write-Host "using host_id=$hostId"

# Add / update sitemap (https preferred; http host still accepts if redirects)
$sitemapUrl = "https://xn--b1agaovdpdkd.xn--p1ai/sitemap.xml"
try {
  $body = (@{ url = $sitemapUrl } | ConvertTo-Json)
  $r = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$hostId/user-added-sitemaps" -Headers $headers -Method Post -Body $body
  Write-Host ("sitemap ok id=" + $r.sitemap_id)
} catch {
  Write-Host ("sitemap: " + $_.ErrorDetails.Message)
}

$urls = @(
  "http://xn--b1agaovdpdkd.xn--p1ai/",
  "http://xn--b1agaovdpdkd.xn--p1ai/favicon-120.png",
  "http://xn--b1agaovdpdkd.xn--p1ai/favicon.ico",
  "http://xn--b1agaovdpdkd.xn--p1ai/favicon.svg",
  "http://xn--b1agaovdpdkd.xn--p1ai/sitemap.xml",
  "http://xn--b1agaovdpdkd.xn--p1ai/gorod/sochi",
  "http://xn--b1agaovdpdkd.xn--p1ai/gorod/sochi/gornye-lyzhi",
  "http://xn--b1agaovdpdkd.xn--p1ai/gorod/moskva",
  "http://xn--b1agaovdpdkd.xn--p1ai/sport/gornye-lyzhi"
)

foreach ($u in $urls) {
  try {
    $body = (@{ url = $u } | ConvertTo-Json)
    $r = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$hostId/recrawl/queue" -Headers $headers -Method Post -Body $body
    Write-Host ("recrawl OK $u left=$($r.quota_remainder)")
  } catch {
    Write-Host ("recrawl skip $u :: " + $_.ErrorDetails.Message)
  }
}

Write-Host "Done. In Webmaster UI also add https host as main mirror when available."
