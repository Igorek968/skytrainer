# Micro-budget Direct funnels (clients + instructors). Data: yandex-direct-micro-funnels-data.json
# Usage:
#   .\scripts\yandex-direct-setup-micro-funnels.ps1
#   .\scripts\yandex-direct-setup-micro-funnels.ps1 -DryRun
#   .\scripts\yandex-direct-setup-micro-funnels.ps1 -LeavePaused
param(
  [string]$Token = "",
  [switch]$DryRun,
  [switch]$LeavePaused
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Read-DotEnv([string]$key) {
  $line = Get-Content .env -Encoding UTF8 -ErrorAction SilentlyContinue |
    Where-Object { $_ -match "^$key=" } |
    Select-Object -First 1
  if (-not $line) { return $null }
  return $line.Substring($key.Length + 1).Trim()
}

function To-Micros([decimal]$rub) {
  return [int64]([math]::Round($rub * 1000000))
}

$script:DirectMinIntervalMs = 450
$script:DirectLastCallUtc = [datetime]::MinValue

function Invoke-Direct([string]$service, [hashtable]$body, [int]$MaxRetries = 5) {
  $uri = "https://api.direct.yandex.com/json/v5/$service"
  $json = ($body | ConvertTo-Json -Depth 25 -Compress)
  if ($DryRun) {
    Write-Host "[DryRun] POST $uri"
    Write-Host $json
    return $null
  }
  $attempt = 0
  while ($true) {
    $attempt++
    $elapsed = ([datetime]::UtcNow - $script:DirectLastCallUtc).TotalMilliseconds
    if ($elapsed -lt $script:DirectMinIntervalMs) {
      Start-Sleep -Milliseconds ([int]($script:DirectMinIntervalMs - $elapsed))
    }
    $tmp = Join-Path $env:TEMP ("direct-" + [guid]::NewGuid().ToString() + ".json")
    [System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
    $resp = & curl.exe -s -X POST $uri `
      -H "Authorization: Bearer $Token" `
      -H "Accept-Language: ru" `
      -H "Content-Type: application/json; charset=utf-8" `
      --data-binary ("@" + $tmp)
    $script:DirectLastCallUtc = [datetime]::UtcNow
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    $obj = $null
    try { $obj = $resp | ConvertFrom-Json } catch {
      if ($attempt -ge $MaxRetries) { throw "Invalid JSON: $resp" }
      Start-Sleep -Seconds ([math]::Min(60, [math]::Pow(2, $attempt)))
      continue
    }
    if ($obj.error) {
      $code = [int]$obj.error.error_code
      if (($code -eq 152 -or $code -eq 506) -and $attempt -lt $MaxRetries) {
        Start-Sleep -Seconds ([math]::Min(120, [int][math]::Pow(2, $attempt) * 5))
        continue
      }
      throw ("Direct API error {0}: {1} - {2}" -f $code, $obj.error.error_string, $obj.error.error_detail)
    }
    return $obj
  }
}

if (-not $Token) { $Token = Read-DotEnv "YANDEX_DIRECT_TOKEN" }
if (-not $Token) { throw "Set YANDEX_DIRECT_TOKEN in .env" }

$dataPath = Join-Path $PSScriptRoot "yandex-direct-micro-funnels-data.json"
if (-not (Test-Path $dataPath)) { throw "Missing $dataPath" }
$data = Get-Content $dataPath -Encoding UTF8 -Raw | ConvertFrom-Json

$site = [string]$data.site
$startDate = Get-Date -Format "yyyy-MM-dd"
$dailyMicros = To-Micros ([decimal]$data.dailyBudgetRub)
$weeklyMicros = To-Micros ([decimal]$data.weeklyLimitRub)
$ceilingMicros = To-Micros ([decimal]$data.bidCeilingRub)
$kwBidMicros = To-Micros ([decimal]$data.keywordBidRub)
$geo = @($data.geoRegionIds | ForEach-Object { [int]$_ })
$metrikaId = [int64]$data.metrikaCounterId

function Make-Utm([string]$path, [string]$campaign, [string]$content) {
  $amp = [string][char]38
  $q = "utm_source=yandex" + $amp + "utm_medium=cpc" + $amp + "utm_campaign=" + $campaign + $amp + "utm_content=" + $content
  if ($path.Contains("?")) { return ($site + $path + $amp + $q) }
  return ($site + $path + "?" + $q)
}

Write-Host "=== MICRO FUNNELS ==="
Write-Host ("Budget day={0} week={1} ceiling={2} kwBid={3}" -f $data.dailyBudgetRub, $data.weeklyLimitRub, $data.bidCeilingRub, $data.keywordBidRub)
Write-Host ("Metrika={0} Geo={1}" -f $metrikaId, ($geo -join ","))

Write-Host "Checking API..."
$ping = Invoke-Direct "campaigns" @{
  method = "get"
  params = @{
    SelectionCriteria = @{}
    FieldNames = @("Id", "Name", "State", "Status")
  }
}
if (-not $DryRun) {
  Write-Host ("OK. Existing: {0}" -f @($ping.result.Campaigns).Count)
}

$createdIds = @()

foreach ($camp in @($data.campaigns)) {
  Write-Host ""
  Write-Host ("=== {0} ===" -f $camp.name)

  $addCamp = Invoke-Direct "campaigns" @{
    method = "add"
    params = @{
      Campaigns = @(
        @{
          Name = [string]$camp.name
          StartDate = $startDate
          DailyBudget = @{ Amount = $dailyMicros; Mode = "STANDARD" }
          NegativeKeywords = @{ Items = @($camp.minusWords) }
          TextCampaign = @{
            BiddingStrategy = @{
              Search = @{
                BiddingStrategyType = "HIGHEST_POSITION"
              }
              Network = @{ BiddingStrategyType = "SERVING_OFF" }
            }
            Settings = @(
              @{ Option = "ENABLE_AREA_OF_INTEREST_TARGETING"; Value = "NO" }
              @{ Option = "ADD_METRICA_TAG"; Value = "YES" }
              @{ Option = "ENABLE_SITE_MONITORING"; Value = "YES" }
            )
            CounterIds = @{ Items = @($metrikaId) }
          }
        }
      )
    }
  }

  if ($DryRun) { continue }

  $campId = $addCamp.result.AddResults[0].Id
  if (-not $campId) {
    throw ("Campaign failed: {0}" -f ($addCamp.result.AddResults[0] | ConvertTo-Json -Depth 8 -Compress))
  }
  $createdIds += $campId
  Write-Host ("CampaignId={0}" -f $campId)

  foreach ($g in @($camp.groups)) {
    $addGroup = Invoke-Direct "adgroups" @{
      method = "add"
      params = @{
        AdGroups = @(@{ Name = [string]$g.name; CampaignId = $campId; RegionIds = $geo })
      }
    }
    $groupId = $addGroup.result.AddResults[0].Id
    if (-not $groupId) {
      throw ("AdGroup failed: {0}" -f ($addGroup.result.AddResults[0] | ConvertTo-Json -Compress))
    }
    Write-Host ("  Group {0}" -f $groupId)

    $href = Make-Utm ([string]$g.path) ([string]$camp.utmCampaign) ([string]$g.content)
    $ads = @(
      @{
        AdGroupId = $groupId
        TextAd = @{
          Title = [string]$g.title
          Title2 = [string]$g.title2
          Text = [string]$g.text
          Href = $href
          DisplayUrlPath = ("{0}/{1}" -f $g.displayPath1, $g.displayPath2)
        }
      }
      @{
        AdGroupId = $groupId
        TextAd = @{
          Title = [string]$g.title
          Title2 = "TvoyTrener.rf Sochi"
          Text = [string]$g.text
          Href = $href
          DisplayUrlPath = ("{0}/{1}" -f $g.displayPath1, $g.displayPath2)
        }
      }
    )
    $addAd = Invoke-Direct "ads" @{ method = "add"; params = @{ Ads = $ads } }
    $adOk = @($addAd.result.AddResults | Where-Object { $_.Id }).Count
    $adErr = @($addAd.result.AddResults | Where-Object { -not $_.Id })
    Write-Host ("  Ads ok={0}" -f $adOk)
    if ($adErr.Count -gt 0) {
      Write-Host ("  Ad warnings: {0}" -f ($adErr | ConvertTo-Json -Depth 6 -Compress))
    }

    $kwPayload = @()
    foreach ($kw in @($g.keywords)) {
      $kwPayload += @{ Keyword = [string]$kw; AdGroupId = $groupId; Bid = $kwBidMicros }
    }
    $addKw = Invoke-Direct "keywords" @{ method = "add"; params = @{ Keywords = $kwPayload } }
    $kwOk = @($addKw.result.AddResults | Where-Object { $_.Id }).Count
    Write-Host ("  Keywords {0}/{1}" -f $kwOk, @($g.keywords).Count)
  }
}

if ($DryRun) {
  Write-Host "DryRun done"
  exit 0
}

if ($createdIds.Count -eq 0) { throw "No campaigns created" }

if ($LeavePaused) {
  Write-Host "Suspending..."
  Invoke-Direct "campaigns" @{
    method = "suspend"
    params = @{ SelectionCriteria = @{ Ids = $createdIds } }
  } | Out-Null
} else {
  Write-Host "Resuming ON..."
  Invoke-Direct "campaigns" @{
    method = "resume"
    params = @{ SelectionCriteria = @{ Ids = $createdIds } }
  } | Out-Null
}

Write-Host ""
Write-Host "DONE. CampaignIds:" ($createdIds -join ", ")
Write-Host "Check Direct UI for moderation + balance."