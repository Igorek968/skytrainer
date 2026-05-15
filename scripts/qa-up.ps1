param(
  [string]$EnvFile = ".env.qa"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $EnvFile)) {
  Write-Error "Env file not found: $EnvFile. Create it from .env.qa.example first."
}

docker compose --env-file $EnvFile -f docker-compose.qa.yml up -d --build
docker compose --env-file $EnvFile -f docker-compose.qa.yml ps
