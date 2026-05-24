# Медленная работа в Docker (Windows)

## Почему «минуты на каждый переход»

1. **`next dev`** — компилирует страницу при первом заходе. В Docker на Windows с bind-mount `./src` это часто **1–5+ минут** на маршрут.
2. **File polling** (`WATCHPACK_POLLING=true`) — постоянно сканирует тысячи файлов, грузит CPU и диск.
3. **Частый опрос API** (каждые 4–15 с) — в dev в Docker добавляет нагрузку.

## Быстрый режим (по умолчанию)

В `docker-compose.yml`:

- `SKIINSTRUCT_NEXT_MODE=prod` → `next build` + **`next start`** (готовые страницы, переходы **секунды**).
- Polling выключен, фоновые опросы API отключены.

### Первый запуск после смены режима

```powershell
cd C:\projects\skytrainer
.\scripts\restart-skiinstruct-fast.ps1
```

Или вручную:

```powershell
docker volume rm skytrainer_skiinstruct_next_cache
$env:SKIINSTRUCT_NEXT_MODE = "prod"
$env:SKIINSTRUCT_FORCE_REBUILD = "1"
docker compose up -d --force-recreate skiinstruct
docker compose logs -f skiinstruct
```

Дождитесь в логах: **`prod: next start`**.  
Первая **`next build`** — **5–20 минут** (один раз). Пока идёт сборка, сайт не отвечает — это нормально.

### После правок в коде

```powershell
docker compose exec skiinstruct sh -c "npm run build && touch .next/.skiinstruct-prod-build"
docker compose restart skiinstruct
```

Или в `.env`: `SKIINSTRUCT_FORCE_REBUILD=1` и `docker compose up -d --force-recreate skiinstruct`.

## Режим разработки (hot-reload)

В корневом `.env`:

```env
SKIINSTRUCT_NEXT_MODE=dev
SKIINSTRUCT_NODE_ENV=development
SKIINSTRUCT_USE_POLLING=1
```

Медленно, но видны правки без пересборки.

## Альтернатива без Docker

```powershell
cd skiinstruct
npm install
npm run dev
```

На Windows **быстрее**, чем `next dev` в контейнере.
