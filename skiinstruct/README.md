# SkiInstruct

Веб‑приложение для вызова инструктора на горнолыжном курорте (цикл заказ → выполнение → оплата).  
Стек: **Next.js 14 (App Router)**, **TypeScript (strict)**, **Tailwind CSS**, **Prisma**, **NextAuth.js (Auth.js v5)**, **React Query**, **Zustand**, **Leaflet**, **Stripe** (test).

Код и комментарии — на английском; интерфейс — на русском.

## Архитектура

- **`src/app`** — маршруты App Router, API Route Handlers (`app/api/**`).
- **`src/features`** — прикладные модули: `features/map`, `features/chat`, `features/geolocation`.
- **`src/entities`** — типы и переиспользуемые доменные обёртки (минимально; основные типы из Prisma).
- **`src/shared`** — UI‑kit (`shared/ui`), утилиты, лейаут.
- **`src/lib`** — инфраструктура (`prisma.ts`), **сервисы** (`lib/services`: гео, статусы заказов), валидации Zod (`lib/validations`).
- **Безопасность**: проверка роли и владения записью в API; Zod на входе; простой **rate limiting** в памяти (`lib/rate-limit.ts`, для продакшена лучше Redis); Stripe webhook проверяется подписью.
- **Геолокация инструктора**: браузерный Geolocation API + `POST /api/instructor/location` с лимитом **не более 2 запросов / минуту на пользователя и IP** (≈ раз в 30 с).

### Схема БД (кратко)

- **User** — роли `CLIENT | INSTRUCTOR | ADMIN`, пароль для credentials или OAuth.
- **InstructorProfile** — ставка, языки, координаты, онлайн, модерация сертификата.
- **Resort** — курорт (центр карты для сидов).
- **Order** — статусы от черновика до завершения; окно **60 с** на ответ инструктора (`pendingExpiresAt`), истечение обрабатывает cron `POST /api/cron/expire-orders`.
- **Message** — чат внутри заказа; на клиенте опрос **каждые 3 с** (React Query).
- **Payment** — связка со Stripe PaymentIntent / Checkout.

Подробная Prisma‑схема: `prisma/schema.prisma`.

## Требования

- Node.js **18+** и npm (или pnpm/yarn).
- PostgreSQL **15+** (локально или Supabase).

## Установка

```bash
cd skiinstruct
cp .env.example .env
# Заполните DATABASE_URL, AUTH_SECRET, и при необходимости Stripe / Google.
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Приложение: `http://localhost:3000`.

## Запуск через Docker Compose (отдельный сервис)

В корневом `docker-compose.yml` сервис **`skiinstruct`** поднимается вместе с **legacy API** (`api`) и общей инфраструктурой (**postgres**, **redis**).

Запуск из корня репозитория:

```bash
docker compose up --build skiinstruct
```

SkiInstruct будет доступен на `http://localhost:3001`.

По умолчанию сервис использует Postgres-контейнер `postgres` и строку:

`postgres://sky:sky@postgres:5432/skytrainer_new?schema=skiinstruct`

То есть данные SkiInstruct изолированы в отдельной PostgreSQL-схеме `skiinstruct`.

### Вход в админку

- URL: `http://localhost:3001/admin/login`
- При старте контейнера выполняется `npm run db:bootstrap-admin`, который создаёт/обновляет администратора из env:
  - `SKIINSTRUCT_ADMIN_EMAIL`
  - `SKIINSTRUCT_ADMIN_PASSWORD`
  - `SKIINSTRUCT_ADMIN_NAME`

### Тестовые учётные записи (после `db seed`)

| Роль        | Email                    | Пароль          |
|------------|---------------------------|-----------------|
| Клиент     | `client@example.com`      | `Password123!`  |
| Инструктор | `instructor1@example.com` | `Password123!`  |
| Админ      | `admin@example.com`     | `Password123!`  |

## Переменные окружения

См. `.env.example`. Обязательные для локального запуска:

- `DATABASE_URL`
- `AUTH_SECRET` (или `NEXTAUTH_SECRET`)
- `AUTH_URL` / `NEXTAUTH_URL` — базовый URL приложения

Опционально:

- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — вход через Google.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` — оплата и редиректы Checkout.
- `CRON_SECRET` — вызов `POST /api/cron/expire-orders` из Vercel Cron или внешнего планировщика.

## Stripe Webhooks (локально)

1. Установите [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Авторизуйтесь: `stripe login`.
3. Проброс вебхуков на локальный сервер:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

CLI выведет **Signing secret** — подставьте его в `.env` как `STRIPE_WEBHOOK_SECRET`.

4. Тестовый платёж: после завершения урока на стороне клиента нажмите «Оплатить картой», завершите Checkout тестовой картой `4242 4242 4242 4242`.

Событие `checkout.session.completed` помечает заказ оплаченным и создаёт запись `Payment`.

## Продакшен (Vercel + Supabase)

1. Создайте проект БД в Supabase, скопируйте connection string в `DATABASE_URL` на Vercel.
2. Выполните миграции: `npx prisma migrate deploy` (CI или локально против продакшен‑URL).
3. Задайте те же env на Vercel, включая `AUTH_SECRET`, `AUTH_URL` (ваш домен), Stripe ключи.
4. В Stripe Dashboard добавьте endpoint вебхука на `https://your-domain/api/webhooks/stripe` и обновите `STRIPE_WEBHOOK_SECRET`.
5. Настройте внешний планировщик на вызов **`POST /api/cron/expire-orders`** с заголовком `Authorization: Bearer <CRON_SECRET>` (или **`GET /api/cron/expire-orders?secret=<CRON_SECRET>`**) примерно раз в минуту. Секрет нельзя коммитить в URL в репозиторий — задавайте endpoint только в настройках хостинга/CI.

## Скрипты

| Команда            | Описание                |
|--------------------|-------------------------|
| `npm run dev`      | Разработка              |
| `npm run build`    | Сборка                  |
| `npm run start`    | Продакшен‑сервер        |
| `npm run lint`     | ESLint                  |
| `npm run db:migrate` | Prisma migrate dev    |
| `npm run db:seed`  | Сид данных             |

## Ограничения и дальнейшая доработка

- Rate limiting в памяти не подходит для горизонтального масштабирования без общего хранилища.
- Web Push: заготовки полей VAPID в `.env`; UI использует Sonner, полноценный SW можно добавить отдельно.
- OSRM маршруты не подключены — для навигации открыта внешняя ссылка OSM.

## Лицензия

MIT (при необходимости добавьте файл LICENSE в репозиторий).
