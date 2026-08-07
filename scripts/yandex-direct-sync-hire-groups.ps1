# Sync hire campaign ad groups/keywords from yandex-direct-prichodi-hire-data.json
# onto existing campaign (default 713347086). Adds missing groups; appends missing keywords.
#
#   .\scripts\yandex-direct-sync-hire-groups.ps1
#   .\scripts\yandex-direct-sync-hire-groups.ps1 -DryRun
#
param(
  [string]$Token = "",
  [string]$ClientLogin = "",
  [long]$CampaignId = 713347086,
  [switch]$DryRun
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

function Invoke-Direct([string]$service, $bodyObj) {
  $json = ($bodyObj | ConvertTo-Json -Depth 14 -Compress)
  $tmp = Join-Path $env:TEMP ("direct-sync-" + [guid]::NewGuid().ToString() + ".json")
  [System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
  $resp = & curl.exe -s -X POST "https://api.direct.yandex.com/json/v5/$service" `
    -H "Authorization: Bearer $Token" `
    -H "Client-Login: $ClientLogin" `
    -H "Accept-Language: ru" `
    -H "Content-Type: application/json; charset=utf-8" `
    --data-binary "@$tmp"
  Remove-Item $tmp -Force
  $obj = $resp | ConvertFrom-Json
  if ($obj.error) {
    throw ("Direct $service error {0}: {1}" -f $obj.error.error_code, $obj.error.error_detail)
  }
  return $obj
}

if (-not $Token) { $Token = Read-DotEnv "YANDEX_DIRECT_TOKEN" }
if (-not $Token) { throw "Set YANDEX_DIRECT_TOKEN in .env" }
if (-not $ClientLogin) { $ClientLogin = Read-DotEnv "YANDEX_DIRECT_CLIENT_LOGIN" }
if (-not $ClientLogin) { $ClientLogin = "tvoitrenerrf" }

$dataPath = Join-Path $PSScriptRoot "yandex-direct-prichodi-hire-data.json"
$data = Get-Content $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$groups = @($data.groups)
$site = "https://xn--b1agaovdpdkd.xn--p1ai"
$landing = "$site$($data.landingPath)"
$geo = @(239)

function Utm([string]$content) {
  return ($landing + "?utm_source=yandex&utm_medium=cpc&utm_campaign=prichodi_hire&utm_content=" + $content)
}

Write-Host ("CampaignId={0} groups in data={1}" -f $CampaignId, $groups.Count)

# Map Content -> AdGroupId via existing ads Href utm_content
$ads = Invoke-Direct "ads" @{
  method = "get"
  params = @{
    SelectionCriteria = @{ CampaignIds = @($CampaignId) }
    FieldNames = @("Id", "AdGroupId", "State", "Status")
    TextAdFieldNames = @("Title", "Href")
  }
}
$contentToGroup = @{}
foreach ($ad in @($ads.result.Ads)) {
  $href = [string]$ad.TextAd.Href
  if ($href -match 'utm_content=([a-z0-9_]+)') {
    $contentToGroup[$Matches[1]] = [int64]$ad.AdGroupId
  }
}
Write-Host ("Existing content keys: {0}" -f (($contentToGroup.Keys | Sort-Object) -join ", "))

# Existing keywords per group
$kwGet = Invoke-Direct "keywords" @{
  method = "get"
  params = @{
    SelectionCriteria = @{ CampaignIds = @($CampaignId) }
    FieldNames = @("Id", "AdGroupId", "Keyword", "State")
  }
}
function Normalize-Keyword([string]$kw) {
  # Direct stores match type separately; Keyword text often without [] / ""
  $t = $kw.Trim().ToLowerInvariant()
  $t = $t -replace '^\[|\]$', ''
  $t = $t -replace '^"|"$', ''
  return $t.Trim()
}

$kwByGroup = @{}
foreach ($kw in @($kwGet.result.Keywords)) {
  $gid = [string]$kw.AdGroupId
  if (-not $kwByGroup.ContainsKey($gid)) { $kwByGroup[$gid] = New-Object 'System.Collections.Generic.HashSet[string]' }
  [void]$kwByGroup[$gid].Add((Normalize-Keyword ([string]$kw.Keyword)))
}

foreach ($g in $groups) {
  $content = [string]$g.Content
  $name = [string]$g.Name
  $desired = @($g.Keywords)

  if ($contentToGroup.ContainsKey($content)) {
    $groupId = $contentToGroup[$content]
    Write-Host ("OK group exists Content={0} AdGroupId={1}" -f $content, $groupId)

    # Update ad titles/text/href if needed — skip (moderation). Only append keywords.
    $existing = if ($kwByGroup.ContainsKey([string]$groupId)) { $kwByGroup[[string]$groupId] } else { New-Object 'System.Collections.Generic.HashSet[string]' }
    $toAdd = @()
    foreach ($kw in $desired) {
      $norm = Normalize-Keyword ([string]$kw)
      if (-not $existing.Contains($norm)) {
        $toAdd += @{
          Keyword = [string]$kw
          AdGroupId = $groupId
          Bid = (To-Micros ([decimal]$g.BidRub))
        }
      }
    }
    if ($toAdd.Count -eq 0) {
      Write-Host "  keywords already up to date"
      continue
    }
    Write-Host ("  adding {0} keywords..." -f $toAdd.Count)
    if ($DryRun) { continue }
    $addKw = Invoke-Direct "keywords" @{ method = "add"; params = @{ Keywords = $toAdd } }
    $kwOk = @($addKw.result.AddResults | Where-Object { $_.Id }).Count
    Write-Host ("  keywords added: {0} / {1}" -f $kwOk, $toAdd.Count)
    continue
  }

  Write-Host ("NEW group Content={0} Name={1}" -f $content, $name)
  if ($DryRun) { continue }

  $addGroup = Invoke-Direct "adgroups" @{
    method = "add"
    params = @{
      AdGroups = @(
        @{ Name = $name; CampaignId = $CampaignId; RegionIds = $geo }
      )
    }
  }
  $groupId = $addGroup.result.AddResults[0].Id
  if (-not $groupId) {
    throw ("AdGroup failed: {0}" -f ($addGroup.result.AddResults[0] | ConvertTo-Json -Compress))
  }
  Write-Host ("  AdGroupId={0}" -f $groupId)

  $href = Utm $content
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
  foreach ($kw in $desired) {
    $kwPayload += @{
      Keyword = [string]$kw
      AdGroupId = $groupId
      Bid = (To-Micros ([decimal]$g.BidRub))
    }
  }
  $addKw = Invoke-Direct "keywords" @{ method = "add"; params = @{ Keywords = $kwPayload } }
  $kwOk = @($addKw.result.AddResults | Where-Object { $_.Id }).Count
  Write-Host ("  Keywords added: {0} / {1}" -f $kwOk, $desired.Count)
  $contentToGroup[$content] = [int64]$groupId
}

# Refresh minus words from data
$minus = @($data.minusWords)
Write-Host ("Updating minus words ({0})..." -f $minus.Count)
if (-not $DryRun) {
  $upd = Invoke-Direct "campaigns" @{
    method = "update"
    params = @{
      Campaigns = @(
        @{
          Id = $CampaignId
          NegativeKeywords = @{ Items = $minus }
        }
      )
    }
  }
  if ($upd.result.UpdateResults[0].Errors) {
    throw ("Minus update errors: {0}" -f ($upd.result.UpdateResults[0].Errors | ConvertTo-Json -Compress))
  }
}

Write-Host ""
Write-Host "Done. Campaign stays paused until you enable it."
