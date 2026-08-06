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

# Prefer verified HTTPS host; fall back to HTTP (recrawl URLs must match host scheme).
$httpsHost = $hosts.hosts | Where-Object { $_.host_id -like "https:xn--b1agaovdpdkd*" -and $_.verified } | Select-Object -First 1
$httpHost = $hosts.hosts | Where-Object { $_.host_id -like "http:xn--b1agaovdpdkd*" } | Select-Object -First 1
$primary = if ($httpsHost) { $httpsHost } else { $httpHost }
if (-not $primary) { $primary = $hosts.hosts | Select-Object -First 1 }
if (-not $primary) { throw "No hosts in Webmaster" }

$hostId = $primary.host_id
$useHttps = $hostId -like "https:*"
$scheme = if ($useHttps) { "https" } else { "http" }
$origin = "${scheme}://xn--b1agaovdpdkd.xn--p1ai"
Write-Host "using host_id=$hostId"

$sitemapUrl = "https://xn--b1agaovdpdkd.xn--p1ai/sitemap.xml"
try {
  $body = (@{ url = $sitemapUrl } | ConvertTo-Json)
  $r = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$hostId/user-added-sitemaps" -Headers $headers -Method Post -Body $body
  Write-Host ("sitemap ok id=" + $r.sitemap_id)
} catch {
  Write-Host ("sitemap: " + $_.ErrorDetails.Message)
}

$urls = @(
  "$origin/",
  "$origin/robots.txt",
  "$origin/favicon-120.png",
  "$origin/favicon.ico",
  "$origin/favicon.svg",
  "$origin/sitemap.xml",
  # Hire funnel (набор инструкторов)
  "$origin/landings/prichodi",
  "$origin/vakansiya",
  "$origin/landings/instructor",
  "$origin/instructor/apply",
  "$origin/oferta-instructor",
  # Demand / SEO hubs
  "$origin/gorod/sochi",
  "$origin/gorod/sochi/gornye-lyzhi",
  "$origin/gorod/krasnaya-polyana",
  "$origin/gorod/krasnaya-polyana/gornye-lyzhi",
  "$origin/gorod/moskva",
  "$origin/sport/gornye-lyzhi",
  "$origin/sport/snoubord",
  "$origin/faq",
  "$origin/gid/kak-vybrat-instruktora",
  "$origin/gid/chto-takoe-tvoytrener"
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

if (-not $httpsHost) {
  Write-Host "HTTPS host missing - run: .\scripts\ensure-yandex-https-mirror.ps1 -OpenBrowser"
} else {
  Write-Host "HTTPS host verified. If MAIN_MIRROR_IS_NOT_HTTPS remains on HTTP host, open:"
  Write-Host "  https://webmaster.yandex.ru/site/http:xn--b1agaovdpdkd.xn--p1ai:80/indexing/mirrors/"
  Write-Host "  then enable Add HTTPS and Save"
}

Write-Host "Done."
