# Deploy QA Stand (Final Link)

## 1. Подготовить сервер

- Linux VM с публичным IP (минимум 2 vCPU, 4 GB RAM).
- Установить Docker + Docker Compose plugin.
- Открыть порты `80` и `443`.
- Прописать A-запись домена на IP сервера (например `qa.yourdomain.com`).

## 2. Подготовить env

Из корня репозитория:

```bash
cp .env.qa.example .env.qa
```

Заполнить минимум:

- `APP_DOMAIN`
- `POSTGRES_PASSWORD`
- `SKIINSTRUCT_DATABASE_URL` (с тем же паролем)
- `SKIINSTRUCT_AUTH_SECRET`
- `SKIINSTRUCT_CRON_SECRET`
- `SKIINSTRUCT_ADMIN_EMAIL`
- `SKIINSTRUCT_ADMIN_PASSWORD`

## 3. Запуск QA-стенда

```bash
docker compose --env-file .env.qa -f docker-compose.qa.yml up -d --build
```

Или одной командой в PowerShell:

```powershell
./scripts/qa-up.ps1 -EnvFile .env.qa
```

Проверка статуса:

```bash
docker compose --env-file .env.qa -f docker-compose.qa.yml ps
```

Ожидаемо:

- `skiinstruct-qa-web` -> `healthy` (или `Up`, затем `healthy`)
- `skytrainer-qa-caddy` -> `Up`
- `skytrainer-qa-postgres` -> `healthy`

## 4. Проверка перед отправкой ссылки

```bash
curl -I https://$APP_DOMAIN
curl -I https://$APP_DOMAIN/api/health
```

Оба ответа должны быть `200`.

PowerShell smoke-check:

```powershell
./scripts/qa-smoke.ps1 -Domain <APP_DOMAIN>
```

## 4.1 Опционально: закрыть QA Basic Auth

Если нужно, чтобы стенд был доступен только тестировщикам с логином/паролем:

1. Сгенерируйте хеш пароля:

```bash
docker run --rm caddy:2-alpine caddy hash-password --plaintext "YourStrongPassword"
```

2. В `Caddyfile` раскомментируйте блок `basicauth` и подставьте логин/хеш.
3. Перезапустите прокси:

```bash
docker compose --env-file .env.qa -f docker-compose.qa.yml up -d caddy
```

## 5. Что отправить тестировщикам

- Ссылка: `https://<APP_DOMAIN>`
- Документ: `TESTING.md`
- Тестовые доступы (admin + пароль)
- Список ограничений (если отключены Stripe/Google)

## 6. Полезные команды сопровождения

Логи:

```bash
docker compose --env-file .env.qa -f docker-compose.qa.yml logs -f skiinstruct
```

Логи автоматически ротируются (`json-file` + `max-size/max-file`), чтобы не забивать диск.

Перезапуск после обновления кода:

```bash
docker compose --env-file .env.qa -f docker-compose.qa.yml up -d --build
```

Остановка:

```bash
docker compose --env-file .env.qa -f docker-compose.qa.yml down
```
