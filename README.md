# Skytrainer

Монорепозиторий: **legacy HTTP API** (`api`), веб‑приложение **SkiInstruct** (`skiinstruct`, Next.js), общие **PostgreSQL** и **Redis** через Docker Compose.

## Локальный запуск (Docker)

1. В корне репозитория скопируйте переменные окружения:

   ```bash
   cp .env.example .env
   ```

   Замените в `.env` секреты (`JWT_SECRET`, `SKIINSTRUCT_*` и т.д.) на свои длинные случайные значения; не коммитьте `.env`.

2. Поднимите сервисы:

   ```bash
   docker compose up -d --build
   ```

   Сервис **skiinstruct** монтирует `./skiinstruct/src` и `./skiinstruct/public`; кэш Next хранится в томе `skiinstruct_next_cache`, чтобы после перезапуска контейнер не компилировал всё заново по несколько минут. Если нужно полностью сбросить кэш Next: `docker volume rm skytrainer_skiinstruct_next_cache` (имя тома смотрите в `docker volume ls`). Зависимости или `prisma/schema.prisma`: `docker compose build skiinstruct --no-cache && docker compose up -d skiinstruct`.

3. Откройте в браузере (важно писать именно **`localhost`**, одна буква **l**):

   | Сервис | URL |
   |--------|-----|
   | SkiInstruct (основной веб‑интерфейс) | http://localhost:3001 |
   | Legacy API | http://localhost:3000 |
   | Проверка API | http://localhost:3000/health |
   | Проверка SkiInstruct | http://localhost:3001/api/health |

Подробности по SkiInstruct: [skiinstruct/README.md](skiinstruct/README.md).

## Публичный QA-стенд (ссылка для тестировщиков)

В репозиторий добавлен отдельный контур для выдачи финальной HTTPS-ссылки:

- `docker-compose.qa.yml` — QA-окружение (postgres, redis, skiinstruct, caddy).
- `skiinstruct/Dockerfile.qa` — production-образ для Next.js.
- `Caddyfile` — reverse proxy и TLS.
- `.env.qa.example` — шаблон переменных окружения.
- `DEPLOY_QA.md` — пошаговый деплой на сервер.
- `TESTING.md` — handoff-док для QA.

Быстрый запуск QA:

```bash
cp .env.qa.example .env.qa
docker compose --env-file .env.qa -f docker-compose.qa.yml up -d --build
```

Для Windows PowerShell можно использовать готовые скрипты:

```powershell
./scripts/qa-up.ps1 -EnvFile .env.qa
./scripts/qa-smoke.ps1 -Domain <APP_DOMAIN>
```

## Legacy Vue‑фронтенд (порт 5173)

Ранее использовался отдельный Vite‑фронтенд; он **удалён** из репозитория и из `docker-compose.yml`. Точка входа для пользователя в браузере — **SkiInstruct на порту 3001**.
