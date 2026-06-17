# Создать приватный репозиторий на GitHub и запушить ветки.
# Требуется: GitHub CLI (winget install GitHub.cli) и gh auth login
#
# Из корня репозитория:
#   .\scripts\setup-github-private-repo.ps1
#   .\scripts\setup-github-private-repo.ps1 -RepoName utrainer

param(
  [string]$RepoName = "skytrainer",
  [switch]$SkipCreate
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$gh = "${env:ProgramFiles}\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) {
  throw "GitHub CLI не найден. Установите: winget install GitHub.cli"
}

& $gh auth status
if ($LASTEXITCODE -ne 0) {
  Write-Host "Войдите в GitHub: gh auth login"
  & $gh auth login
}

if (-not $SkipCreate) {
  if (git remote get-url origin 2>$null) {
    Write-Host "[skip] remote origin уже настроен"
  }
  else {
    Write-Host "[create] private repo: $RepoName"
    & $gh repo create $RepoName --private --source=. --remote=origin --description "Utrainer / Skytrainer"
  }
}

$branches = @("yandex-experement", "main", "dev")
foreach ($b in $branches) {
  if (git show-ref --verify --quiet "refs/heads/$b") {
    Write-Host "[push] $b"
    git push -u origin $b
  }
}

Write-Host "[done] $(git remote get-url origin)"
