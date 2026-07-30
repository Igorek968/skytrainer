# Create Yandex Direct SEARCH campaigns for ТвойТренер.рф (paused until you enable + pay).
# Requires:
#   1) Direct account with API access approved
#   2) At least one draft campaign created in UI (Yandex requirement for API page)
#   3) YANDEX_DIRECT_TOKEN in repo root .env (OAuth with Direct scopes)
#
# Usage:
#   .\scripts\yandex-direct-create-search-campaigns.ps1
#   .\scripts\yandex-direct-create-search-campaigns.ps1 -DryRun
#   .\scripts\yandex-direct-create-search-campaigns.ps1 -Sandbox
param(
  [string]$Token = "",
  [switch]$Sandbox,
  [switch]$DryRun,
  [int]$DailyBudgetRub = 100
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Read-DotEnv([string]$key) {
  $line = Get-Content .env -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return $line.Substring($key.Length + 1).Trim()
}

function To-Micros([decimal]$rub) {
  return [int64]([math]::Round($rub * 1000000))
}

function Invoke-Direct([string]$service, [hashtable]$body) {
  $base = if ($Sandbox) { "https://api-sandbox.direct.yandex.com/json/v5" } else { "https://api.direct.yandex.com/json/v5" }
  $uri = "$base/$service"
  $json = ($body | ConvertTo-Json -Depth 20 -Compress)
  if ($DryRun) {
    Write-Host "[DryRun] POST $uri"
    Write-Host $json
    return $null
  }
  $resp = curl.exe -s -X POST $uri `
    -H "Authorization: Bearer $Token" `
    -H "Accept-Language: ru" `
    -H "Content-Type: application/json; charset=utf-8" `
    --data-binary $json
  $obj = $resp | ConvertFrom-Json
  if ($obj.error) {
    throw ("Direct API error {0}: {1} — {2}" -f $obj.error.error_code, $obj.error.error_string, $obj.error.error_detail)
  }
  return $obj
}

if (-not $Token) { $Token = Read-DotEnv "YANDEX_DIRECT_TOKEN" }
if (-not $Token) { throw "Set YANDEX_DIRECT_TOKEN in .env (OAuth token with Direct API access)" }

$origin = "https://xn--b1agaovdpdkd.xn--p1ai" # твойтренер.рф punycode-safe
# Prefer unicode host in ads — Direct accepts IDN
$site = "https://твойтренер.рф"
$startDate = (Get-Date).ToString("yyyy-MM-dd")
$dailyMicros = To-Micros $DailyBudgetRub

# Geo: Sochi (239). Network OFF — search only.
$geo = @(239)

$campaignsSpec = @(
  @{
    Name = "Поиск | Сочи-КП | Лыжи Сноуборд"
    Groups = @(
      @{
        Name = "Горные лыжи — Сочи"
        Url  = "$site/gorod/sochi/gornye-lyzhi"
        Title = "Инструктор по горным лыжам в Сочи"
        Title2 = "Бронь онлайн · оплата ЮKassa"
        Text = "Найдите свободного инструктора на карте. Заявка за минуту — ответ рядом с курортом."
        Path1 = "sochi"; Path2 = "lyzhi"
        Keywords = @(
          "[инструктор по горным лыжам сочи]",
          "[инструктор горные лыжи сочи]",
          "[уроки горных лыж сочи]",
          "[занятия горные лыжи сочи]",
          '"инструктор по горным лыжам сочи"',
          '"инструктор горные лыжи сочи"',
          '"уроки горных лыж сочи"',
          '"горнолыжный инструктор сочи"',
          '"найти инструктора горные лыжи сочи"',
          '"заказать инструктора лыжи сочи"'
        )
        BidRub = 12
      },
      @{
        Name = "Горные лыжи — Красная Поляна"
        Url  = "$site/gorod/krasnaya-polyana/gornye-lyzhi"
        Title = "Инструктор лыж · Красная Поляна"
        Title2 = "Роза Хутор и рядом · ТвойТренер"
        Text = "Частные инструкторы у курортов. Выберите на карте и отправьте заявку сегодня."
        Path1 = "polyana"; Path2 = "lyzhi"
        Keywords = @(
          "[инструктор горные лыжи красная поляна]",
          "[инструктор по горным лыжам красная поляна]",
          "[инструктор горные лыжи роза хутор]",
          "[уроки горных лыж красная поляна]",
          '"инструктор лыжи красная поляна"',
          '"инструктор горные лыжи красная поляна"',
          '"инструктор роза хутор"',
          '"инструктор газпром альпика"',
          '"горнолыжный инструктор красная поляна"',
          '"уроки лыж красная поляна"'
        )
        BidRub = 12
      },
      @{
        Name = "Сноуборд — Сочи / КП"
        Url  = "$site/gorod/sochi/snoubord"
        Title = "Инструктор по сноуборду в Сочи"
        Title2 = "Красная Поляна · запись онлайн"
        Text = "Подбор инструктора рядом с трассой. Карта, рейтинг, безопасная оплата."
        Path1 = "sochi"; Path2 = "snoubord"
        Keywords = @(
          "[инструктор сноуборд сочи]",
          "[инструктор по сноуборду сочи]",
          "[уроки сноуборда сочи]",
          "[инструктор сноуборд красная поляна]",
          '"инструктор сноуборд сочи"',
          '"инструктор по сноуборду сочи"',
          '"уроки сноуборда сочи"',
          '"инструктор сноуборд красная поляна"',
          '"инструктор сноуборд роза хутор"',
          '"занятия сноуборд сочи"'
        )
        BidRub = 12
      }
    )
  },
  @{
    Name = "Поиск | Сочи | Инструктор общий"
    Groups = @(
      @{
        Name = "Инструктор Сочи"
        Url  = "$site/gorod/sochi"
        Title = "Найти инструктора в Сочи"
        Title2 = "Маркетплейс ТвойТренер.рф"
        Text = "Личные инструкторы на карте. Заявка онлайн, оплата через ЮKassa."
        Path1 = "gorod"; Path2 = "sochi"
        Keywords = @(
          "[инструктор сочи]",
          "[найти инструктора сочи]",
          "[заказать инструктора сочи]",
          '"инструктор сочи"',
          '"найти инструктора сочи"',
          '"личный инструктор сочи"',
          '"частный инструктор сочи"',
          '"инструктор на карте сочи"'
        )
        BidRub = 7
      },
      @{
        Name = "Инструктор Красная Поляна"
        Url  = "$site/gorod/krasnaya-polyana"
        Title = "Инструктор в Красной Поляне"
        Title2 = "Карта · бронь · ЮKassa"
        Text = "Свободные инструкторы рядом с курортом. Выберите и отправьте заявку."
        Path1 = "polyana"; Path2 = "instr"
        Keywords = @(
          "[инструктор красная поляна]",
          "[найти инструктора красная поляна]",
          '"инструктор красная поляна"',
          '"найти инструктора красная поляна"',
          '"частный инструктор красная поляна"'
        )
        BidRub = 7
      }
    )
  }
)

$sharedMinus = @(
  "вакансия", "работа", "зарплата", "резюме", "курс", "курсы", "обучение", "диплом",
  "сертификат", "бесплатно", "скачать", "фото", "видео", "википедия", "авто", "права",
  "гибдд", "пдд", "москва", "спб", "питер", "екатеринбург", "казань", "аренда",
  "прокат", "скипасс", "отель", "жильё", "тур", "путевка", "билеты", "расписание"
)

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

$createdCampaignIds = @()

foreach ($camp in $campaignsSpec) {
  Write-Host "`n=== Campaign: $($camp.Name) ==="
  $addCamp = Invoke-Direct "campaigns" @{
    method = "add"
    params = @{
      Campaigns = @(
        @{
          Name = $camp.Name
          StartDate = $startDate
          DailyBudget = @{
            Amount = $dailyMicros
            Mode = "STANDARD"
          }
          NegativeKeywords = @{
            Items = $sharedMinus
          }
          TextCampaign = @{
            BiddingStrategy = @{
              Search = @{
                BiddingStrategyType = "HIGHEST_POSITION"
              }
              Network = @{
                BiddingStrategyType = "SERVING_OFF"
              }
            }
            Settings = @(
              @{ Option = "ENABLE_AREA_OF_INTEREST_TARGETING"; Value = "NO" }
            )
          }
        }
      )
    }
  }

  if ($DryRun) { continue }

  $campId = $addCamp.result.AddResults[0].Id
  if (-not $campId) {
    $err = $addCamp.result.AddResults[0].Errors | ConvertTo-Json -Compress
    throw "Failed to create campaign '$($camp.Name)': $err"
  }
  $createdCampaignIds += $campId
  Write-Host "CampaignId=$campId"

  foreach ($g in $camp.Groups) {
    $addGroup = Invoke-Direct "adgroups" @{
      method = "add"
      params = @{
        AdGroups = @(
          @{
            Name = $g.Name
            CampaignId = $campId
            RegionIds = $geo
          }
        )
      }
    }
    $groupId = $addGroup.result.AddResults[0].Id
    if (-not $groupId) {
      throw ("AdGroup failed: {0}" -f ($addGroup.result.AddResults[0] | ConvertTo-Json -Compress))
    }
    Write-Host "  AdGroupId=$groupId ($($g.Name))"

    $addAd = Invoke-Direct "ads" @{
      method = "add"
      params = @{
        Ads = @(
          @{
            AdGroupId = $groupId
            TextAd = @{
              Title = $g.Title
              Title2 = $g.Title2
              Text = $g.Text
              Href = $g.Url
              DisplayUrlPath = "$($g.Path1)/$($g.Path2)"
            }
          }
        )
      }
    }
    $adId = $addAd.result.AddResults[0].Id
    if (-not $adId) {
      throw ("Ad failed: {0}" -f ($addAd.result.AddResults[0] | ConvertTo-Json -Compress))
    }
    Write-Host "  AdId=$adId"

    $kwPayload = @()
    foreach ($kw in $g.Keywords) {
      $kwPayload += @{
        Keyword = $kw
        AdGroupId = $groupId
        Bid = (To-Micros $g.BidRub)
      }
    }
    $addKw = Invoke-Direct "keywords" @{
      method = "add"
      params = @{ Keywords = $kwPayload }
    }
    $kwOk = @($addKw.result.AddResults | Where-Object { $_.Id }).Count
    Write-Host "  Keywords added: $kwOk / $($g.Keywords.Count)"
  }
}

if (-not $DryRun -and $createdCampaignIds.Count -gt 0) {
  Write-Host "`nSuspending campaigns (no spend until you enable)..."
  $suspend = Invoke-Direct "campaigns" @{
    method = "suspend"
    params = @{
      SelectionCriteria = @{ Ids = $createdCampaignIds }
    }
  }
  Write-Host ($suspend | ConvertTo-Json -Depth 6 -Compress)
  Write-Host "`nDone. Campaign IDs: $($createdCampaignIds -join ', ')"
  Write-Host "Next: top up Direct balance → open campaigns → Enable → wait for moderation."
}
elseif ($DryRun) {
  Write-Host "`nDryRun complete — no API writes."
}
