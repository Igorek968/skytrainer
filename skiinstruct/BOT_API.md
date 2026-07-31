# API сайта ↔ Telegram-бот канала ТвойТренер.рф

Контракт для связки **маркетплейса** и **публичного Telegram-канала** `@tvoitrenerrf`.

| Сайт | Бот / канал |
|------|-------------|
| Источник правды: инструкторы, online, мероприятия, отзывы, модерация | Публикация в канал + CTA на сайт |
| Шлёт события наружу (outbound webhook) | Принимает `POST` на три хука |
| Deep-link’и на профиль / спорт / запись / регистрацию | Не выдумывает данные сайта |
| — | Комментарии — только пользователи (группа обсуждения). Бот **не** пишет и **не** отвечает в комментариях |
| — | Реакции — нативные TG, набор: 🔥 ❤️ 🥱 ⛺ 💥. Бот реакции **не** ставит |

Сайт **не** постит в канал сам, **не** модерирует комменты канала, **не** ставит реакции.

---

## Статус готовности (сайт)

| Пункт | Статус |
|-------|--------|
| Этот файл + `BOT_API_SECRET` в корневом `.env` | ✅ готово |
| `GET /api/bot/health`, `GET /api/bot/instructors` | ✅ код + Docker |
| Outbound: `instructor-approved` / `instructor-online` / `event-published` | ✅ вызываются на реальных действиях |
| `BOT_OUTBOUND_WEBHOOK_BASE_URL` | ✅ локально: `http://channel-bot:8787` (сервис `channel-bot` в Docker) |
| Хуки ДР / отзывов | ❌ этап 2 (поля в БД частично есть, webhook’ов нет) |

**Prod API base:** `https://твойтренер.рф`  
**Локально (Docker):** `http://localhost:3001`

Авторизация везде одна: **`Authorization: Bearer <BOT_API_SECRET>`** (не HMAC). Тот же секрет на inbound и outbound.

---

## Env

### Сайт (корень репозитория `.env`, проброс в `docker-compose` → `skiinstruct`)

```env
# Общий секрет сайт ↔ бот (Bearer). Без него /api/bot/* → 503.
BOT_API_SECRET=<см. корневой .env>

# Базовый URL бота БЕЗ завершающего слэша.
# Локально (оба в Docker): http://channel-bot:8787
# Внешний бот: https://<публичный-url-бота>
BOT_OUTBOUND_WEBHOOK_BASE_URL=http://channel-bot:8787
```

После смены URL:

```powershell
docker compose up -d --build channel-bot
docker compose up -d --force-recreate skiinstruct
```

`GET /api/bot/health` должен показать `"outbound": true`.

Сервис `channel-bot` принимает три хука и публикует в `CHANNEL_ID` (бот должен быть админом канала).

### Только для бота (не нужны контейнеру сайта)

В корневом `.env` лежат ключи канала / Provod (секция `CHANNEL_BOT_*` / `PROVOD_*`). Их сайт **не** читает — отдай разработчику бота отдельно.

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

Только одобренные (`APPROVED`), не demo, не suspended. Поле `sport` — **канонический label с эмодзи** (первое направление профиля).

---

## Сайт → бот (push)

```http
POST {BOT_OUTBOUND_WEBHOOK_BASE_URL}/hooks/<name>
Authorization: Bearer <BOT_API_SECRET>
Content-Type: application/json
X-Tvoytrener-Event: <name>
```

Бот отвечает `2xx`. Ошибки логируются на сайте (`[bot-api]`), модерация/онлайн **не** блокируются.

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

Когда: инструктор переключает статус `isOnline: false → true` (первый выход на линию в этом переключении).

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

Когда: админ одобряет мероприятие (`PENDING_REVIEW → PUBLISHED`).

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
`signup_url` сейчас ведёт на маркетинговую `/events?id=…` (параметр `id` карточку на карте пока не открывает). Кнопку «Записаться» можно вести на `signup_url` или на главную `/` / профиль инструктора — пока нет отдельного deep-link карточки события на карте.

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
| Мероприятия (лендинг) | `/events` |
| Запись с хука | `signup_url` из `event-published` |
| Регистрация инструктора | `/instructor/apply` |
| Найм / «Приходи» | `/landings/prichodi` |
| Канал Telegram (кнопка после регистрации) | `https://t.me/tvoitrenerrf` |

Регистрация инструктора на сайте **≠** автоподписка в TG. Только кнопка/ссылка «Вступить в канал».

### Примеры

```
https://твойтренер.рф/instructors/clx123
https://твойтренер.рф/?specialization=%F0%9F%8E%BF%20%D0%93%D0%BE%D1%80%D0%BD%D1%8B%D0%B5%20%D0%BB%D1%8B%D0%B6%D0%B8
https://твойтренер.рф/sport/gornye-lyzhi
https://твойтренер.рф/gorod/sochi/gornye-lyzhi
https://твойтренер.рф/instructor/apply?utm_source=telegram&utm_campaign=channel
https://твойтренер.рф/landings/prichodi
```

### SEO-slug’и популярных направлений (лендинги `/sport/…`)

Полный каталог анкеты шире; для SEO-лендингов — витрина маркетплейса:

| Label (как в API `sport`) | slug |
|---------------------------|------|
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

Города SEO: `sochi`, `krasnaya-polyana`, `moskva`, … (см. `skiinstruct/src/lib/seo-landings.ts`).

Полный список label’ов анкеты: `INSTRUCTOR_ACTIVITY_LABELS` в `skiinstruct/src/lib/services/instructor-match.ts` (лыжи, вода, бег, йога, …). Для фильтра API достаточно короткого `sport=лыжи` / `sport=йога`.

---

## Этап 2 (заложить, сайт пока не шлёт)

- **ДР инструктора** — в профиле есть `birthDate`; webhook / cron-выборка ещё не сделаны.
- **Отзыв** — тексты отзывов есть в заказах; отдельного `review-published` хука нет.

Когда появятся — добавим в этот файл JSON и путь хука без смены схемы авторизации.

---

## Пакет разработчику бота

1. Этот файл `skiinstruct/BOT_API.md`.
2. Из корневого `.env` сайта: **`BOT_API_SECRET`** (имя + значение).
3. Ключи бота TG / Provod из `.env` (`BOT_TOKEN` / `CHANNEL_ID` / `PROVOD_*` — секция канала).
4. Prod: `https://твойтренер.рф/api/bot/health` и `/api/bot/instructors`.
5. Поднять `POST /hooks/instructor-approved|instructor-online|event-published` с проверкой Bearer.
6. Отдать публичный URL → в `.env` сайта `BOT_OUTBOUND_WEBHOOK_BASE_URL` + recreate → `outbound: true`.
7. Совместный тест: approve / online / publish event → посты в канале.
8. Дальше без блокеров сайта: опросы (Telegram Poll + `GET …/instructors?sport=&online=1`), UGC в ЛС, контент-план.

### Чеклист сайта для бота

- [x] `BOT_API.md` + секрет
- [x] Три outbound-хука на реальных действиях
- [x] `BOT_OUTBOUND_WEBHOOK_BASE_URL` + recreate → `health.outbound === true`
- [x] Примеры JSON + deep-link’и в доке
- [x] Выборка online-инструкторов по виду спорта
