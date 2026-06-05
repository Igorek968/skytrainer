# SkiInstruct localhost:3001 — рабочая сборка (snapshot)

Зафиксировано: **2026-06-05**, ветка `yandex-experement` (коммит: `git rev-parse --short HEAD`). Использовать эти настройки для локального :3001.

## Проверенная конфигурация

| Параметр | Значение |
|----------|----------|
| URL | http://localhost:3001 |
| Контейнер | `skiinstruct-web` |
| Порт | `3001:3000` (хост:контейнер) |
| Режим | `SKIINSTRUCT_NEXT_MODE=prod` |
| NODE_ENV | `production` |
| Next.js | 14.2.21 |
| Polling | `SKIINSTRUCT_USE_POLLING=false` |
| BUILD_ID | `GfKsQ71RyfGihLAvvBVFv` |

## Как поднять / восстановить

```powershell
# из корня репозитория
.\scripts\use-skiinstruct-prod-3001.ps1
```

После правок в `skiinstruct/`:

```powershell
.\scripts\refresh-skiinstruct-3001.ps1
```

Refresh **обязательно** делает:
1. `docker compose up -d skiinstruct`
2. сброс `/app/.next/.skiinstruct-src-hash` в контейнере
3. `docker compose restart skiinstruct` → entrypoint → `next build` → `next start`

Без `restart` prod не пересобирается.

## Готовность

```powershell
docker compose logs -f skiinstruct
```

Ждать: `[entry] prod: next start :3000` и `Ready`.

## Не переключать без причины

- **prod** — быстрый сайт на :3001 (по умолчанию).
- **dev** в Docker на Windows — очень медленно; только `.\scripts\use-skiinstruct-dev-3001.ps1`.
- Быстрый UI-dev без Docker: `cd skiinstruct; npm run dev` (порт 3000).

## docker-compose.yml (ключевое)

- Volumes: `./skiinstruct/src`, `./public`, `skiinstruct_next_cache:/app/.next`
- Entrypoint: `skiinstruct/scripts/docker-dev-entrypoint.sh`
