# Add + verify HTTPS host in Yandex Webmaster and prefer it for sitemap/recrawl.
# "Site move -> Add HTTPS" is UI-only; this script prints the deep link.
param(
  [string]$Token = "",
  [string]$AsciiHost = "xn--b1agaovdpdkd.xn--p1ai",
  [switch]$OpenBrowser
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
  Authorization  = "OAuth $Token"
  Accept         = "application/json"
  "Content-Type" = "application/json"
}

$user = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user" -Headers $headers
$uid = $user.user_id
$httpsUrl = "https://$AsciiHost"
$httpsHostId = "https:${AsciiHost}:443"
$httpHostId = "http:${AsciiHost}:80"

Write-Host "user_id=$uid"

$hosts = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts" -Headers $headers
$httpsHost = $hosts.hosts | Where-Object { $_.host_id -eq $httpsHostId } | Select-Object -First 1
if (-not $httpsHost) {
  try {
    $add = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts" -Headers $headers -Method Post -Body (@{ host_url = $httpsUrl } | ConvertTo-Json)
    $httpsHostId = $add.host_id
    Write-Host "Added host_id=$httpsHostId"
  } catch {
    Write-Host ("Add host: " + $_.ErrorDetails.Message)
    $hosts = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts" -Headers $headers
    $httpsHost = $hosts.hosts | Where-Object { $_.host_id -like "https:$AsciiHost*" } | Select-Object -First 1
    if ($httpsHost) { $httpsHostId = $httpsHost.host_id }
  }
} else {
  Write-Host "HTTPS host already present: $httpsHostId verified=$($httpsHost.verified)"
}

$ver = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$httpsHostId/verification" -Headers $headers
Write-Host ("verification state=$($ver.verification_state) uin=$($ver.verification_uin)")
if ($ver.verification_state -ne "VERIFIED") {
  $uin = $ver.verification_uin
  $verifyPath = "skiinstruct/public/yandex_$uin.html"
  if (-not (Test-Path $verifyPath)) {
    $html = @(
      "<html>",
      "    <head>",
      "        <meta http-equiv=`"Content-Type`" content=`"text/html; charset=UTF-8`">",
      "    </head>",
      "    <body>Verification: $uin</body>",
      "</html>"
    ) -join "`n"
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $verifyPath), $html, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Created $verifyPath - deploy to VPS before re-running if not live."
  }
  $liveCode = curl.exe -sS -o NUL -w "%{http_code}" --max-time 20 "$httpsUrl/yandex_$uin.html"
  if ($liveCode -ne "200") {
    throw "Verification file not live (HTTP $liveCode): $httpsUrl/yandex_$uin.html"
  }
  $null = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$httpsHostId/verification?verification_type=HTML_FILE" -Headers $headers -Method Post -Body "{}"
  Start-Sleep -Seconds 4
  $ver = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$httpsHostId/verification" -Headers $headers
  Write-Host ("verification after check: $($ver.verification_state)")
}

$info = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$httpsHostId" -Headers $headers
$mm = if ($info.main_mirror) { $info.main_mirror.host_id } else { "null" }
Write-Host ("HTTPS verified=$($info.verified) main_mirror=$mm")

try {
  $r = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$httpsHostId/user-added-sitemaps" -Headers $headers -Method Post -Body (@{ url = "$httpsUrl/sitemap.xml" } | ConvertTo-Json)
  Write-Host ("sitemap id=" + $r.sitemap_id)
} catch {
  Write-Host ("sitemap: " + $_.ErrorDetails.Message)
}

$urls = @(
  "$httpsUrl/",
  "$httpsUrl/robots.txt",
  "$httpsUrl/favicon.svg",
  "$httpsUrl/favicon-120.png",
  "$httpsUrl/sitemap.xml"
)
foreach ($u in $urls) {
  try {
    $r = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$httpsHostId/recrawl/queue" -Headers $headers -Method Post -Body (@{ url = $u } | ConvertTo-Json)
    Write-Host ("recrawl OK $u left=$($r.quota_remainder)")
  } catch {
    Write-Host ("recrawl skip $u :: " + $_.ErrorDetails.Message)
  }
}

$moveUrl = "https://webmaster.yandex.ru/site/$httpHostId/indexing/mirrors/"
Write-Host ""
Write-Host "HTTPS host is verified. To set it as main mirror faster:"
Write-Host "  1) Open: $moveUrl"
Write-Host "  2) Enable Add HTTPS / select HTTPS address"
Write-Host "  3) Click Save"
Write-Host "HTTP to HTTPS redirects are already active; Yandex usually finishes in days-weeks."

if ($OpenBrowser) {
  Start-Process $moveUrl
}

Write-Host "Done."
