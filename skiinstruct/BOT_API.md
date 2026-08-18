# API сайта ↔ Telegram-бот канала ТвойТренер.рф

Контракт для связки **маркетплейса** и **публичного Telegram-канала** `@tvoitrenerrf`.

Репозиторий контент-бота канала: **`telegram_news_bot`** (aiogram, cron, provod.ai, SQLite).  
Этот файл — только API **сайта** (`skiinstruct`); постинг афиши/AI — зона `telegram_news_bot`.

## Два контура

| Контур | Кто | Что |
|--------|-----|-----|
| **A. Канал (контент)** | `telegram_news_bot` | Cron 08/14/18 МСК, парсеры афиши + content plan + AI → `send_photo` / `send_message` |
| **B. Канал (живые события сайта)** | Сайт → webhook → бот | `instructor-approved` / `instructor-online` / `event-published` |
| **C. ЛС** | `telegram_news_bot` | `/start` онбординг → кнопка на сайт (не канал) |

Пользователи **не** пишут в канал. Комменты — группа обсуждения TG. Реакции — настройка канала (🔥 ❤️ 🥱 ⛺ 💥), бот их не ставит.

| Сайт | Бот канала |
|------|------------|
| Источник правды: инструкторы, online, события, отзывы, модерация | Публикация + CTA на сайт |
| Шлёт outbound webhook | Принимает `POST /hooks/…` (цель: `telegram_news_bot`; сейчас временно `channel-bot` в Docker сайта) |
| Deep-link’и / `GET /api/bot/instructors` | Не выдумывает данные сайта |
| **Не** держит `BOT_TOKEN` / `PROVOD_*` в идеале | Токен и Provod — только у бота |

Сайт **не** модерирует комменты и **не** ставит реакции. Прямой постинг с сайта — только через webhook-приёмник (не минуя бота).

---

## Статус готовности (сайт)

| Пункт | Статус |
|-------|--------|
| Этот файл + `BOT_API_SECRET` в корневом `.env` | ✅ готово |
| `GET /api/bot/health`, `GET /api/bot/instructors` | ✅ код + Docker |
| Outbound: `instructor-approved` / `instructor-online` / `event-published` | ✅ вызываются на реальных действиях |
| `BOT_OUTBOUND_WEBHOOK_BASE_URL` | ✅ сейчас `http://channel-bot:8787` (временный bridge на VPS сайта). Цель — URL `telegram_news_bot` с `/hooks/…` |
| IPv4 pin `api.telegram.org → 149.154.167.220` у `channel-bot` | ✅ иначе с РФ-VPS timeout до Telegram |
| Хуки в репо `telegram_news_bot` | ❌ ещё нет HTTP `/hooks/…` (long polling only) |
| Хуки ДР / отзывов | ❌ этап 2 |

**Prod API base:** `https://твойтренер.рф`  
**Локально (Docker):** `http://localhost:3001`

Авторизация везде одна: **`Authorization: Bearer <BOT_API_SECRET>`** (не HMAC). Тот же секрет на inbound и outbound.

---

## Env

### Сайт (корень `.env` → `skiinstruct` в Docker)

```env
# Общий секрет сайт ↔ бот (Bearer). Без него /api/bot/* → 503.
BOT_API_SECRET=<см. корневой .env>

# Базовый URL приёмника хуков БЕЗ завершающего слэша.
# Сейчас (bridge): http://channel-bot:8787
# Цель (telegram_news_bot): https://<публичный-url-бота>
BOT_OUTBOUND_WEBHOOK_BASE_URL=http://channel-bot:8787
```

После смены URL:

```powershell
docker compose up -d --force-recreate skiinstruct
```

`GET /api/bot/health` → `"outbound": true`.

### Бот (`telegram_news_bot`) — не в контейнере сайта

```env
BOT_TOKEN=
CHANNEL_ID=@tvoitrenerrf   # или -100…
PROVOD_API_KEY=
# PROVOD_BASE_URL= / TEXT_MODEL= / IMAGE_MODEL=
BOT_API_SECRET=            # тот же, что на сайте
```

**Сайту отдаём:** этот `BOT_API.md` + `BOT_API_SECRET`.  
**Сайту не нужны:** `BOT_TOKEN`, `PROVOD_API_KEY` (после отказа от временного `channel-bot`).

Временный сервис `channel-bot/` в монорепо сайта — только bridge, пока в `telegram_news_bot` нет `/hooks/…`. На РФ-VPS у него `extra_hosts: api.telegram.org:149.154.167.220`.

---

## Бот → сайт (pull)

Заголовок: `Authorization: Bearer <BOT_API_SECRET>`.

### `GET /api/bot/health`

```http
GET https://твойтренер.рф/api/bot/health
Authorization: Bearer <BOT_API_SECRET>
```

```json
{
  "ok": true,
  "inbound": true,
  "outbound": true,
  "endpoints": {
    "instructors": "/api/bot/instructors?sport=лыжи&online=1",
    "health": "/api/bot/health"
  },
  "outbound_hooks": [
    "POST {BOT_OUTBOUND_WEBHOOK_BASE_URL}/hooks/instructor-approved",
    "POST {BOT_OUTBOUND_WEBHOOK_BASE_URL}/hooks/instructor-online",
    "POST {BOT_OUTBOUND_WEBHOOK_BASE_URL}/hooks/event-published"
  ]
}
```

Если `BOT_API_SECRET` не задан → `503`. Неверный Bearer → `401`.

### `GET /api/bot/instructors` — для опросов / новостей / CTA

```http
GET https://твойтренер.рф/api/bot/instructors?sport=лыжи&online=1&limit=20
Authorization: Bearer <BOT_API_SECRET>
```

| Параметр | Описание |
|----------|----------|
| `sport` | Фильтр по направлению (частичное совпадение / синонимы, как на сайте) |
| `online=1` | Только «на линии» |
| `limit` | 1–50, по умолчанию 20 |

```json
{
  "instructors": [
    {
      "id": "clx…",
      "name": "Иван",
      "sport": "🎿 Горные лыжи",
      "photo_url": "https://твойтренер.рф/api/media/…",
      "profile_url": "https://твойтренер.рф/instructors/clx…",
      "city": "Сочи",
      "is_online": true
    }
  ]
}
```

Только одобренные (`APPROVED`), не demo, не suspended. Поле `sport` — **канонический label с эмодзи**.

---

## Сайт → бот (push)

```http
POST {BOT_OUTBOUND_WEBHOOK_BASE_URL}/hooks/<name>
Authorization: Bearer <BOT_API_SECRET>
Content-Type: application/json
X-Tvoytrener-Event: <name>
```

Бот отвечает `2xx`. Ошибки логируются на сайте (`[bot-api]`), модерация/онлайн **не** блокируются.

Рекомендуемый CTA в постах канала (как в `telegram_news_bot`):  
`https://твойтренер.рф/?utm_source=tg&utm_medium=post&utm_campaign=…`  
Для живых хуков — кнопки на `profile_url` / `signup_url` из JSON (+ UTM по желанию бота).

### 1. `POST /hooks/instructor-approved`

Когда: админ одобряет анкету (`verificationStatus → APPROVED`).

```json
{
  "id": "clx…",
  "name": "Иван",
  "sport": "🎿 Горные лыжи",
  "photo_url": "https://твойтренер.рф/api/media/…",
  "profile_url": "https://твойтренер.рф/instructors/clx…",
  "city": "Сочи",
  "is_online": false
}
```

### 2. `POST /hooks/instructor-online`

Когда: инструктор переключает `isOnline: false → true`.

```json
{
  "id": "clx…",
  "name": "Иван",
  "sport": "🎿 Горные лыжи",
  "photo_url": "https://твойтренер.рф/api/media/…",
  "profile_url": "https://твойтренер.рф/instructors/clx…",
  "city": "Сочи",
  "is_urgent": true
}
```

### 3. `POST /hooks/event-published`

Когда: админ одобряет событие (`PENDING_REVIEW → PUBLISHED`).

```json
{
  "id": "clx…",
  "title": "Утренняя тренировка",
  "date": "2026-08-10",
  "place": "Сириус",
  "sport": "плавание",
  "image_url": "https://твойтренер.рф/api/media/…",
  "signup_url": "https://твойтренер.рф/events?id=clx…"
}
```

`date` — `YYYY-MM-DD` или `null`.

---

## Deep-link шаблоны (prod: `https://твойтренер.рф`)

| Цель | URL |
|------|-----|
| Карточка инструктора | `/instructors/{id}` |
| Отзывы инструктора | `/instructors/{id}/reviews` |
| Карта + фильтр по виду спорта | `/?specialization={encodeURIComponent(label)}` |
| SEO-лендинг вида спорта | `/sport/{slug}` |
| Город | `/gorod/{citySlug}` |
| Город + спорт | `/gorod/{citySlug}/{sportSlug}` |
| События (лендинг) | `/events` |
| Запись с хука | `signup_url` из `event-published` |
| Регистрация инструктора | `/instructor/apply` |
| Найм / «Приходи» | `/landings/prichodi` |
| Канал Telegram | `https://t.me/tvoitrenerrf` |

Регистрация инструктора ≠ автоподписка в TG — только кнопка «Вступить в канал».

### Примеры

```
https://твойтренер.рф/instructors/clx123
https://твойтренер.рф/sport/gornye-lyzhi
https://твойтренер.рф/gorod/sochi/gornye-lyzhi
https://твойтренер.рф/instructor/apply?utm_source=telegram&utm_campaign=channel
https://твойтренер.рф/?utm_source=tg&utm_medium=post&utm_campaign=value_42
```

### SEO-slug’и популярных направлений (`/sport/…`)

| Label | slug |
|-------|------|
| 🎿 Горные лыжи | `gornye-lyzhi` |
| ⛷ Сноуборд | `snoubord` |
| 🏒 Хоккей с шайбой | `hokkej-s-shajboj` |
| ⛸️ Фигурное катание | `figurnoe-katanie` |
| 🏊 Плавание | `plavanie` |
| 🏄 Серфинг | `serfing` |
| 🛶 Сапсёрфинг | `sapsyorfing` |
| 🚵 Маунтибайк | `mauntibajk` |
| ⚽ Футбол | `futbol` |
| 🏐 Волейбол | `volejbol` |
| 🏀 Баскетбол | `basketbol` |
| 🎾 Большой теннис | `bolshoj-tennis` |
| 🥊 Бокс | `boks` |
| 🥋 MMA (смешанные единоборства) | `mma-smeshannye-edinoborstva` |
| 🧘 Йога | `joga` |
| 🧗 Скалолазание | `skalolazanie` |
| ♿ Адаптивный спорт | `adaptivnyj-sport` |
| 🚗 Автоинструктор | `avtoinstruktor` |

Города: `sochi`, `krasnaya-polyana`, … (`seo-landings.ts`).  
Полный каталог анкеты: `INSTRUCTOR_ACTIVITY_LABELS` в `instructor-match.ts`.

---

## Этап 2 (сайт пока не шлёт)

- ДР инструктора (`birthDate`) — webhook ещё нет.
- Отзыв — отдельного `review-published` нет.

---

## Пакет разработчику `telegram_news_bot`

1. Этот файл.
2. **`BOT_API_SECRET`** (тот же, что на сайте) — не `BOT_TOKEN`/`PROVOD_*` с сайта.
3. Prod pull: `https://твойтренер.рф/api/bot/health`, `/api/bot/instructors`.
4. Поднять HTTP: `POST /hooks/instructor-approved|instructor-online|event-published` + Bearer.
5. Доступ к Telegram с хоста бота (IPv4 pin `149.154.167.220` / зарубежный VPS / прокси).
6. Отдать публичный URL → на сайте `BOT_OUTBOUND_WEBHOOK_BASE_URL=https://…` + recreate → выключить временный `channel-bot`.
7. Тест: approve / online / publish event → посты в канале.
8. Дальше: опросы + `GET …/instructors?sport=&online=1`, UGC в ЛС.

### Чеклист сайта

- [x] `BOT_API.md` + секрет
- [x] Три outbound-хука на реальных действиях
- [x] `health.outbound === true` (на bridge)
- [x] Примеры JSON + deep-link’и
- [x] Выборка online-инструкторов по спорту
- [ ] Переключение outbound на `telegram_news_bot` (когда появятся `/hooks/…`)
