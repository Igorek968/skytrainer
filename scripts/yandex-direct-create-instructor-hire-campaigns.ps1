﻿# Create Yandex Direct SEARCH campaign: instructor hire -> /landings/prichodi
# Requires approved Direct API access + YANDEX_DIRECT_TOKEN in .env
# Usage:
#   .\scripts\yandex-direct-create-instructor-hire-campaigns.ps1
#   .\scripts\yandex-direct-create-instructor-hire-campaigns.ps1 -DryRun
param(
  [string]$Token = "",
  [string]$ClientLogin = "",
  [switch]$Sandbox,
  [switch]$DryRun,
  [int]$DailyBudgetRub = 150
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

# Sequential calls only (Direct limit: <=5 parallel; we use 1).
# Min pause between requests + retry on units shortage (error 152).
$script:DirectMinIntervalMs = 400
$script:DirectLastCallUtc = [datetime]::MinValue

function Invoke-Direct([string]$service, [hashtable]$body, [int]$MaxRetries = 5) {
  $base = if ($Sandbox) {
    "https://api-sandbox.direct.yandex.com/json/v5"
  } else {
    "https://api.direct.yandex.com/json/v5"
  }
  $uri = "$base/$service"
  $json = ($body | ConvertTo-Json -Depth 20 -Compress)
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
    $hdrFile = Join-Path $env:TEMP ("direct-hdr-" + [guid]::NewGuid().ToString() + ".txt")
    [System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
    $hdr = @(
      "-H", "Authorization: Bearer $Token",
      "-H", "Accept-Language: ru",
      "-H", "Content-Type: application/json; charset=utf-8",
      "-D", $hdrFile
    )
    if ($ClientLogin) {
      $hdr += @("-H", "Client-Login: $ClientLogin")
    }

    $resp = & curl.exe -s -X POST $uri @hdr --data-binary ("@" + $tmp)
    $script:DirectLastCallUtc = [datetime]::UtcNow
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue

    # Units: spent/remaining/daily — учитываем остаток баллов
    if (Test-Path $hdrFile) {
      $unitsLine = Select-String -Path $hdrFile -Pattern '(?i)^Units:\s*(.+)$' | Select-Object -First 1
      if ($unitsLine) {
        Write-Host ("  [Units] {0}" -f $unitsLine.Matches[0].Groups[1].Value.Trim())
        $parts = ($unitsLine.Matches[0].Groups[1].Value -split '/')
        if ($parts.Count -ge 2) {
          $remaining = 0
          [void][int]::TryParse(($parts[1].Trim()), [ref]$remaining)
          if ($remaining -gt 0 -and $remaining -lt 50) {
            Write-Host "  Low units remaining; backing off 60s..."
            Start-Sleep -Seconds 60
          }
        }
      }
      Remove-Item $hdrFile -Force -ErrorAction SilentlyContinue
    }

    $obj = $null
    try { $obj = $resp | ConvertFrom-Json } catch {
      if ($attempt -ge $MaxRetries) { throw "Invalid JSON from Direct API: $resp" }
      Start-Sleep -Seconds ([math]::Min(60, [math]::Pow(2, $attempt)))
      continue
    }

    if ($obj.error) {
      $code = [int]$obj.error.error_code
      $estr = [string]$obj.error.error_string
      $edet = [string]$obj.error.error_detail
      # 152 = not enough units; 506 = concurrent limit — retry with backoff
      if (($code -eq 152 -or $code -eq 506) -and $attempt -lt $MaxRetries) {
        $wait = [math]::Min(120, [int][math]::Pow(2, $attempt) * 5)
        Write-Host ("  API $code ($estr); retry in ${wait}s (attempt $attempt/$MaxRetries)")
        Start-Sleep -Seconds $wait
        continue
      }
      throw "Direct API error ${code}: ${estr} - ${edet}"
    }
    return $obj
  }
}

if (-not $Token) { $Token = Read-DotEnv "YANDEX_DIRECT_TOKEN" }
if (-not $Token) { throw "Set YANDEX_DIRECT_TOKEN in .env" }
if (-not $ClientLogin) { $ClientLogin = Read-DotEnv "YANDEX_DIRECT_CLIENT_LOGIN" }

$site = "https://xn--b1agaovdpdkd.xn--p1ai"
$landing = "$site/landings/prichodi"
$startDate = (Get-Date).ToString("yyyy-MM-dd")
$dailyMicros = To-Micros $DailyBudgetRub
$geo = @(239)

function Utm([string]$content) {
  return ($landing + "?utm_source=yandex&utm_medium=cpc&utm_campaign=prichodi_hire&utm_content=" + $content)
}

$dataPath = Join-Path $PSScriptRoot "yandex-direct-prichodi-hire-data.json"
if (-not (Test-Path $dataPath)) { throw "Missing $dataPath" }
$data = Get-Content $dataPath -Encoding UTF8 -Raw | ConvertFrom-Json
$campaignName = [string]$data.campaignName
$groups = @($data.groups)
$sharedMinus = @($data.minusWords)

Write-Host "Checking Direct API access..."
$ping = Invoke-Direct "campaigns" @{
  method = "get"
  params = @{
    SelectionCriteria = @{}
    FieldNames = @("Id", "Name", "State", "Status")
  }
}
if (-not $DryRun) {
  Write-Host ("OK. Existing campaigns: {0}" -f @($ping.result.Campaigns).Count)
}

Write-Host ""
Write-Host ("=== Campaign: {0} ===" -f $campaignName)
$addCamp = Invoke-Direct "campaigns" @{
  method = "add"
  params = @{
    Campaigns = @(
      @{
        Name = $campaignName
        StartDate = $startDate
        DailyBudget = @{ Amount = $dailyMicros; Mode = "STANDARD" }
        NegativeKeywords = @{ Items = $sharedMinus }
        TextCampaign = @{
          BiddingStrategy = @{
            Search = @{ BiddingStrategyType = "HIGHEST_POSITION" }
            Network = @{ BiddingStrategyType = "SERVING_OFF" }
          }
          Settings = @(
            @{ Option = "ENABLE_AREA_OF_INTEREST_TARGETING"; Value = "NO" }
          )
        }
      }
    )
  }
}

if ($DryRun) {
  Write-Host ""
  Write-Host "DryRun complete - no API writes."
  Write-Host ("Landing: {0}" -f $landing)
  Write-Host ("Groups: {0}" -f $groups.Count)
  exit 0
}

$campId = $addCamp.result.AddResults[0].Id
if (-not $campId) {
  throw ("Failed to create campaign: {0}" -f ($addCamp.result.AddResults[0] | ConvertTo-Json -Compress))
}
Write-Host ("CampaignId={0}" -f $campId)

foreach ($g in $groups) {
  $addGroup = Invoke-Direct "adgroups" @{
    method = "add"
    params = @{
      AdGroups = @(
        @{ Name = [string]$g.Name; CampaignId = $campId; RegionIds = $geo }
      )
    }
  }
  $groupId = $addGroup.result.AddResults[0].Id
  if (-not $groupId) {
    throw ("AdGroup failed: {0}" -f ($addGroup.result.AddResults[0] | ConvertTo-Json -Compress))
  }
  Write-Host ("  AdGroupId={0} ({1})" -f $groupId, $g.Name)

  $href = Utm ([string]$g.Content)
  $addAd = Invoke-Direct "ads" @{
    method = "add"
    params = @{
      Ads = @(
        @{
          AdGroupId = $groupId
          TextAd = @{
            Title = [string]$g.Title
            Title2 = [string]$g.Title2
            Text = [string]$g.Text
            Href = $href
            DisplayUrlPath = ("{0}/{1}" -f $g.Path1, $g.Path2)
          }
        }
      )
    }
  }
  $adId = $addAd.result.AddResults[0].Id
  if (-not $adId) {
    throw ("Ad failed: {0}" -f ($addAd.result.AddResults[0] | ConvertTo-Json -Compress))
  }
  Write-Host ("  AdId={0}" -f $adId)

  $kwPayload = @()
  foreach ($kw in @($g.Keywords)) {
    $kwPayload += @{
      Keyword = [string]$kw
      AdGroupId = $groupId
      Bid = (To-Micros ([decimal]$g.BidRub))
    }
  }
  $addKw = Invoke-Direct "keywords" @{
    method = "add"
    params = @{ Keywords = $kwPayload }
  }
  $kwOk = @($addKw.result.AddResults | Where-Object { $_.Id }).Count
  Write-Host ("  Keywords added: {0} / {1}" -f $kwOk, @($g.Keywords).Count)
}

Write-Host ""
Write-Host "Suspending campaign (no spend until you enable)..."
Invoke-Direct "campaigns" @{
  method = "suspend"
  params = @{ SelectionCriteria = @{ Ids = @($campId) } }
} | Out-Null

Write-Host ""
Write-Host ("Done. CampaignId={0}" -f $campId)
Write-Host ("Landing: {0}" -f $landing)
Write-Host "Next: top up Direct -> Enable campaign -> wait for moderation."
