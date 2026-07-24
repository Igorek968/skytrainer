# Шаблон восстановления доступа к ТвойТренер.рф / Skytrainer

> **Не коммитьте заполненный файл с реальными значениями.**  
> Скопируйте в менеджер паролей (1Password, Bitwarden и т.п.) или зашифрованный архив.  
> Образцы переменных: `.env.example`, `.env.qa.example`, `skiinstruct/.env.example`.

Дата заполнения: `____________________`  
Кто заполнил: `____________________`

---

## 1. Репозиторий и разработка

| Что | Где хранить | Значение (заполнить) |
|-----|-------------|----------------------|
| GitHub (приватный репо) | URL | `https://github.com/________/skytrainer` |
| GitHub логин | | |
| Personal Access Token (если HTTPS push) | менеджер паролей | |
| SSH-ключ для GitHub | `~/.ssh/id_ed25519` (приватный) | публичный ключ в GitHub → Settings → SSH keys |
| Локальный путь к проекту | | `C:\projects\skytrainer` |
| Активная ветка прод-разработки | | `yandex-experement` |
| Cursor / IDE аккаунт | | |

---

## 2. Домен и хостинг (прод: твойтренер.рф)

| Что | Где | Значение |
|-----|-----|----------|
| Домен | регистратор | `твойтренер.рф` |
| DNS-панель (логин) | | |
| A-запись → IP VPS | | `___ . ___ . ___ . ___` |
| VPS провайдер (логин) | | |
| VPS IP | | |
| SSH хост (alias) | `~/.ssh/config` | `Host vps` |
| SSH пользователь | | `root` / `ubuntu` / … |
| SSH ключ или пароль | менеджер паролей | |
| Путь на сервере | | `/opt/skytrainer` |
| Прод URL | | `https://твойтренер.рф` |

Пример `~/.ssh/config`:

```
Host vps
  HostName <IP_VPS>
  User <user>
  IdentityFile ~/.ssh/<ключ>
```

---

## 3. Файлы окружения (секреты — **не в git**)

Скопируйте и храните отдельно от репозитория.

### Локальная разработка — `.env` (корень репо)

Создание: `cp .env.example .env`

| Переменная | Назначение | Заполнено |
|------------|------------|-----------|
| `JWT_SECRET` | legacy API | ☐ |
| `SKIINSTRUCT_AUTH_SECRET` | сессии NextAuth | ☐ |
| `SKIINSTRUCT_CRON_SECRET` | cron API | ☐ |
| `SKIINSTRUCT_DATABASE_URL` | Postgres (Docker) | ☐ |
| `SKIINSTRUCT_ADMIN_EMAIL` | первый админ | ☐ |
| `SKIINSTRUCT_ADMIN_PASSWORD` | пароль админа | ☐ |
| `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` | оплата | ☐ |
| `SKIINSTRUCT_SMTP_PASSWORD` | почта Beget | ☐ |
| `MAX_BOT_TOKEN` | бот поддержки MAX | ☐ |
| `MAX_SUPPORT_USER_ID` / `MAX_SUPPORT_CHAT_ID` | куда слать тикеты | ☐ |
| `MAX_WEBHOOK_SECRET` | webhook MAX → сайт | ☐ |
| `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` | карты /client | ☐ |
| `SKIINSTRUCT_AUTH_GOOGLE_ID` / `SECRET` | Google OAuth | ☐ |
| `SKIINSTRUCT_VAPID_PUBLIC_KEY` | web push (клиент) | ☐ |
| `SKIINSTRUCT_VAPID_PRIVATE_KEY` | web push (сервер) | ☐ |
| `SKIINSTRUCT_VAPID_SUBJECT` | `mailto:…` для VAPID | ☐ |

### Прод / VPS — `.env.qa` (корень репо, на сервере `/opt/skytrainer/.env.qa`)

Создание: `cp .env.qa.example .env.qa`

| Переменная | Назначение | Заполнено |
|------------|------------|-----------|
| `APP_DOMAIN` | | `твойтренер.рф` |
| `APP_PUBLIC_URL` | | `https://твойтренер.рф` |
| `POSTGRES_PASSWORD` | БД на VPS | ☐ |
| `SKIINSTRUCT_DATABASE_URL` | тот же пароль | ☐ |
| `SKIINSTRUCT_AUTH_SECRET` | **должен совпадать** с тем, что был при выпуске сессий | ☐ |
| `SKIINSTRUCT_CRON_SECRET` | | ☐ |
| `ALLOW_MOCK_CHECKOUT` | `0` на проде | ☐ |
| `REQUIRE_EMAIL_VERIFICATION` | `1` на проде | ☐ |
| `YOOKASSA_*` | реальная касса | ☐ |
| `SKIINSTRUCT_SMTP_*` | noreply@твойтренер.рф | ☐ |
| `MAX_*` | поддержка | ☐ |
| `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` | нужен при `docker build` | ☐ |
| `SKIINSTRUCT_VAPID_PUBLIC_KEY` | web push (клиент, build arg) | ☐ |
| `SKIINSTRUCT_VAPID_PRIVATE_KEY` | web push (сервер) | ☐ |
| `SKIINSTRUCT_VAPID_SUBJECT` | `mailto:noreply@твойтренер.рф` | ☐ |

---

## 4. TLS (Let's Encrypt / Caddy)

| Что | Путь | Примечание |
|-----|------|------------|
| Сертификаты (локальная копия) | `deploy/caddy-data/` | **в .gitignore**, бэкапить вручную |
| Синхронизация с VPS | | `.\scripts\caddy-sync-certs.ps1 -Direction Pull` |
| На сервер | `/opt/skytrainer/deploy/caddy-data/` | bind-mount в Caddy |

Без `deploy/caddy-data/` после переустановки сервера Caddy заново запросит сертификат (нужна рабочая A-запись).

---

## 5. База данных

| Что | Где | Значение |
|-----|-----|----------|
| Имя БД | | `skytrainer_new` |
| Схема приложения | | `skiinstruct` |
| Пользователь Postgres | | `sky` |
| Пароль Postgres | `.env` / `.env.qa` | см. выше |
| Локальные бэкапы | `backups/postgres/` | `skytrainer_YYYY-MM-DD_*.sql.gz` |
| Скрипт бэкапа | | `.\scripts\backup-postgres.ps1` |
| Восстановление (пример) | | `gunzip -c backup.sql.gz \| docker compose exec -T postgres psql -U sky -d skytrainer_new` |

На VPS: том Docker `postgres_data` (или как в `docker-compose.qa.yml`). Периодически снимайте `pg_dump` с прод-сервера.

---

## 6. Внешние сервисы (логины в ЛК)

| Сервис | URL | Что сохранить |
|--------|-----|---------------|
| ЮKassa | https://yookassa.ru | shop_id, secret, webhook URL `https://твойтренер.рф/api/webhooks/yookassa` |
| Beget (почта) | https://beget.com | SMTP, ящик `noreply@твойтренер.рф` |
| Яндекс.Карты | https://developer.tech.yandex.ru | API-ключ (JS + Геокодер) |
| MAX (бот) | https://dev.max.ru | токен бота, webhook |
| Google Cloud (OAuth) | https://console.cloud.google.com | Client ID / Secret, redirect URIs |
| Stripe (если используется) | https://dashboard.stripe.com | test/live keys, webhook secret |
| Роскомнадзор (ПДн) | | номер уведомления → `NEXT_PUBLIC_PDN_REGISTRY_NUMBER` |

---

## 7. Деплой и локальный стенд

| Действие | Команда / документ |
|----------|-------------------|
| Документация QA/прод | `DEPLOY_QA.md` |
| Локальный сайт | http://localhost:3001 (`skiinstruct-web` в Docker) |
| Обновить :3001 после правок | `.\scripts\refresh-skiinstruct-3001.ps1` |
| Prod в Docker локально | `.\scripts\use-skiinstruct-prod-3001.ps1` |
| Деплой на VPS | `.\scripts\deploy-vps.ps1` (или tar+scp вручную) |
| Compose на VPS | `docker compose --env-file .env.qa -f docker-compose.qa.yml` |
| Снимок рабочей :3001 | `scripts/skiinstruct-3001.snapshot.md` |

---

## 8. Админка и тестовые аккаунты

| Роль | Email | Пароль | Примечание |
|------|-------|--------|------------|
| Админ (локально) | | | из `SKIINSTRUCT_ADMIN_*` |
| Админ (прод) | | | сменить после первого входа |
| Тестовый инструктор | | | |
| Тестовый клиент | | | |

---

## 9. Чеклист «всё потерял — восстановить с нуля»

1. ☐ Клонировать приватный репозиторий с GitHub  
2. ☐ Восстановить `.env` и `.env.qa` из менеджера паролей  
3. ☐ Восстановить `deploy/caddy-data/` или выпустить новые сертификаты  
4. ☐ Настроить SSH `vps` и залить код на `/opt/skytrainer`  
5. ☐ `docker compose --env-file .env.qa -f docker-compose.qa.yml up -d --build`  
6. ☐ Проверить `curl -I https://твойтренер.рф/api/health`  
7. ☐ При необходимости восстановить БД из `backups/postgres/`  
8. ☐ Проверить webhook ЮKassa, MAX, SMTP (тестовое письмо / сброс пароля)  
9. ☐ Локально: `docker compose up -d`, `.\scripts\refresh-skiinstruct-3001.ps1`

---

## 10. Где лежат копии (указать свои)

| Копия | Место | Дата последнего бэкапа |
|-------|-------|------------------------|
| `.env` | | |
| `.env.qa` | | |
| `deploy/caddy-data/` | | |
| `backups/postgres/` | | |
| SSH ключи | | |
| Этот шаблон (заполненный) | | |
