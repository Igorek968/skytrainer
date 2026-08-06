# Create Metrika JS goals for instructor hire + bind as Direct PriorityGoals.
# Requires Metrika OAuth token with scopes metrika:read + metrika:write.
#
# 1) Open authorize URL (or pass -MetrikaToken):
#    https://oauth.yandex.ru/authorize?response_type=token&client_id=<YANDEX_OAUTH_CLIENT_ID>&scope=metrika:read%20metrika:write
# 2) After allow, copy access_token from redirect URL fragment.
# 3) .\scripts\yandex-bind-hire-metrika-goals.ps1 -MetrikaToken "y0_..."
#
param(
  [string]$MetrikaToken = "",
  [string]$DirectToken = "",
  [string]$ClientLogin = "",
  [long]$CampaignId = 713347086,
  [long]$CounterId = 110595574,
  # Target CPA for bid adjustments (RUB). Used as PriorityGoals.Value.
  [int]$SubmitCpaRub = 150,
  [int]$SuccessCpaRub = 300
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

if (-not $MetrikaToken) { $MetrikaToken = Read-DotEnv "YANDEX_METRIKA_TOKEN" }
if (-not $DirectToken) { $DirectToken = Read-DotEnv "YANDEX_DIRECT_TOKEN" }
if (-not $ClientLogin) { $ClientLogin = Read-DotEnv "YANDEX_DIRECT_CLIENT_LOGIN" }
if (-not $DirectToken) { throw "Set YANDEX_DIRECT_TOKEN" }
if (-not $ClientLogin) { $ClientLogin = "tvoitrenerrf" }

if (-not $MetrikaToken) {
  # Prefer Direct app (issued current Direct token), then generic OAuth client from .env
  $cidDirectApp = "da94d6cd18084ef8bf0fddd52883e569"
  $cid = Read-DotEnv "YANDEX_OAUTH_CLIENT_ID"
  if (-not $cid) { $cid = $cidDirectApp }
  $scope = [uri]::EscapeDataString("metrika:read metrika:write")
  $authUrl = "https://oauth.yandex.ru/authorize?response_type=token&client_id=$cidDirectApp&scope=$scope&force_confirm=yes"
  $authUrlAlt = if ($cid -and $cid -ne $cidDirectApp) {
    "https://oauth.yandex.ru/authorize?response_type=token&client_id=$cid&scope=$scope&force_confirm=yes"
  } else { $null }
  Write-Host "Metrika token missing. Open and allow access (login tvoitrenerrf), then re-run with -MetrikaToken:"
  Write-Host $authUrl
  if ($authUrlAlt) { Write-Host "Alt app:"; Write-Host $authUrlAlt }
  try { Start-Process $authUrl } catch {}
  throw "Pass -MetrikaToken from the redirect URL (access_token=...)"
}

$mHeaders = @{
  Authorization = "OAuth $MetrikaToken"
  Accept        = "application/json"
  "Content-Type" = "application/json"
}

Write-Host "Listing goals for counter $CounterId ..."
$existing = Invoke-RestMethod -Uri "https://api-metrika.yandex.net/management/v1/counter/$CounterId/goals" -Headers $mHeaders
$goals = @($existing.goals)
Write-Host ("Found {0} goals" -f $goals.Count)

function Find-GoalId([string]$ident) {
  foreach ($g in $goals) {
    $conds = @($g.conditions)
    foreach ($c in $conds) {
      if ([string]$c.url -eq $ident -or [string]$c.value -eq $ident) {
        return [int64]$g.id
      }
    }
    if ([string]$g.name -match [regex]::Escape($ident)) {
      return [int64]$g.id
    }
  }
  return $null
}

function Ensure-JsGoal([string]$ident, [string]$name) {
  $id = Find-GoalId $ident
  if ($id) {
    Write-Host ("OK exists {0} -> GoalId={1}" -f $ident, $id)
    return $id
  }
  Write-Host ("Creating goal {0} ..." -f $ident)
  $payload = @{
    goal = @{
      name = $name
      type = "action"
      conditions = @(
        @{ type = "exact"; url = $ident }
      )
    }
  } | ConvertTo-Json -Depth 8 -Compress
  $created = Invoke-RestMethod `
    -Uri "https://api-metrika.yandex.net/management/v1/counter/$CounterId/goals" `
    -Headers $mHeaders `
    -Method Post `
    -Body $payload
  $newId = [int64]$created.goal.id
  Write-Host ("Created {0} -> GoalId={1}" -f $ident, $newId)
  $script:goals += $created.goal
  return $newId
}

$submitId = Ensure-JsGoal "instructor_apply_submit" "Анкета инструктора (отправка)"
$successId = Ensure-JsGoal "instructor_apply_success" "Анкета инструктора (успех)"

# Persist token + goal ids for later
$envPath = Join-Path (Get-Location) ".env"
$envText = Get-Content $envPath -Raw -Encoding UTF8
function Upsert-Env([string]$key, [string]$value) {
  if ($script:envText -match "(?m)^$key=") {
    $script:envText = [regex]::Replace($script:envText, "(?m)^$key=.*$", "$key=$value")
  } else {
    if (-not $script:envText.EndsWith("`n")) { $script:envText += "`n" }
    $script:envText += "$key=$value`n"
  }
}
Upsert-Env "YANDEX_METRIKA_TOKEN" $MetrikaToken
Upsert-Env "YANDEX_METRIKA_GOAL_APPLY_SUBMIT" "$submitId"
Upsert-Env "YANDEX_METRIKA_GOAL_APPLY_SUCCESS" "$successId"
[System.IO.File]::WriteAllText($envPath, $envText, [System.Text.UTF8Encoding]::new($false))
Write-Host "Saved goal ids to .env"

# Bind PriorityGoals on Direct campaign
$update = @{
  method = "update"
  params = @{
    Campaigns = @(
      @{
        Id = $CampaignId
        TextCampaign = @{
          CounterIds = @{ Items = @($CounterId) }
          AttributionModel = "AUTO"
          PriorityGoals = @{
            Items = @(
              @{
                GoalId = $submitId
                Value = (To-Micros $SubmitCpaRub)
                Operation = "SET"
                IsMetrikaSourceOfValue = "NO"
              },
              @{
                GoalId = $successId
                Value = (To-Micros $SuccessCpaRub)
                Operation = "SET"
                IsMetrikaSourceOfValue = "NO"
              }
            )
          }
        }
      }
    )
  }
}
$json = ($update | ConvertTo-Json -Depth 12 -Compress)
$tmp = Join-Path $env:TEMP ("direct-pg-" + [guid]::NewGuid().ToString() + ".json")
[System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Binding PriorityGoals on campaign $CampaignId ..."
$resp = & curl.exe -s -X POST "https://api.direct.yandex.com/json/v5/campaigns" `
  -H "Authorization: Bearer $DirectToken" `
  -H "Client-Login: $ClientLogin" `
  -H "Accept-Language: ru" `
  -H "Content-Type: application/json; charset=utf-8" `
  --data-binary "@$tmp"
Remove-Item $tmp -Force
Write-Host $resp
$obj = $resp | ConvertFrom-Json
if ($obj.error) {
  throw ("Direct error {0}: {1}" -f $obj.error.error_code, $obj.error.error_detail)
}
if ($obj.result.UpdateResults[0].Errors) {
  throw ("Update errors: {0}" -f ($obj.result.UpdateResults[0].Errors | ConvertTo-Json -Compress))
}

# Verify
$verifyBody = '{"method":"get","params":{"SelectionCriteria":{"Ids":[' + $CampaignId + ']},"FieldNames":["Id","Name"],"TextCampaignFieldNames":["CounterIds","PriorityGoals","AttributionModel"]}}'
$tmp2 = Join-Path $env:TEMP "direct-pg-v.json"
[System.IO.File]::WriteAllText($tmp2, $verifyBody, [System.Text.UTF8Encoding]::new($false))
$ver = & curl.exe -s -X POST "https://api.direct.yandex.com/json/v5/campaigns" `
  -H "Authorization: Bearer $DirectToken" `
  -H "Client-Login: $ClientLogin" `
  -H "Accept-Language: ru" `
  -H "Content-Type: application/json; charset=utf-8" `
  --data-binary "@$tmp2"
Remove-Item $tmp2 -Force
Write-Host "Verify:"
Write-Host $ver
Write-Host ""
Write-Host "Done. submit=$submitId success=$successId bound to campaign $CampaignId"
