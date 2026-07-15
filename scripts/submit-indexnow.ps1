# Submit public URLs to Yandex IndexNow (and peers).
# Requires the key file on the live site: /4ca507ae0d53f067978dd6277e88a6d3.txt
param(
  [string]$HostName = "xn--b1agaovdpdkd.xn--p1ai",
  [string]$Key = "4ca507ae0d53f067978dd6277e88a6d3"
)

$ErrorActionPreference = "Stop"
$origin = "https://$HostName"
$keyLocation = "$origin/$Key.txt"

Write-Host "Checking key file $keyLocation ..."
$keyRes = curl.exe -sS -o NUL -w "%{http_code}" --max-time 20 $keyLocation
if ($keyRes -ne "200") {
  throw "Key file not reachable (HTTP $keyRes). Deploy skiinstruct to VPS first."
}

$urls = @(
  "$origin/",
  "$origin/robots.txt",
  "$origin/sitemap.xml",
  "$origin/llms.txt",
  "$origin/ai.txt",
  "$origin/faq",
  "$origin/gid/kak-vybrat-instruktora",
  "$origin/gid/pervyj-urok-gornye-lyzhi-sochi",
  "$origin/favicon.svg",
  "$origin/favicon-120.png",
  "$origin/favicon.ico",
  "$origin/instructor/apply",
  "$origin/support",
  "$origin/oferta",
  "$origin/privacy",
  "$origin/gorod/sochi",
  "$origin/gorod/moskva",
  "$origin/sport/gornye-lyzhi",
  "$origin/gorod/sochi/gornye-lyzhi",
  "$origin/gorod/krasnaya-polyana/gornye-lyzhi"
)

$body = @{
  host        = $HostName
  key         = $Key
  keyLocation = $keyLocation
  urlList     = $urls
} | ConvertTo-Json -Compress

Write-Host "Submitting $($urls.Count) URLs to https://yandex.com/indexnow ..."
$tmp = [System.IO.Path]::GetTempFileName()
try {
  [System.IO.File]::WriteAllText($tmp, $body, [System.Text.UTF8Encoding]::new($false))
  $resp = curl.exe -sS -w "`nHTTP_STATUS:%{http_code}" -X POST "https://yandex.com/indexnow" `
    -H "Content-Type: application/json; charset=utf-8" `
    --data-binary "@$tmp"
  Write-Host $resp
} finally {
  Remove-Item $tmp -ErrorAction SilentlyContinue
}

Write-Host "Done. In Yandex Webmaster: Diagnostics -> re-check robots.txt / favicon."
