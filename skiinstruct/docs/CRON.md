# Cron-задачи skiinstruct

## Push-напоминания (уроки + мероприятия за ~1 ч)

**По умолчанию встроены в приложение** — при старте контейнера `skiinstruct` планировщик тикает каждые 60 с (`SKIINSTRUCT_INTERNAL_SCHEDULER=1` в `docker-compose.yml`). Внешний cron для напоминаний **не обязателен**.

Отключить встроенный планировщик: `SKIINSTRUCT_INTERNAL_SCHEDULER=0` и настроить внешний вызов `lesson-reminders` ниже.

Требуется Web Push (VAPID): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

---

Остальные задачи требуют секрет `SKIINSTRUCT_CRON_SECRET` (`?secret=...` или `Authorization: Bearer ...`).

| Задача | URL | Рекомендуемый интервал |
|--------|-----|------------------------|
| Автоотмена неоплаченных / просроченных заказов | `GET /api/cron/expire-orders` | каждые 5 мин |
| Push-напоминания (резерв, если встроенный выкл.) | `GET /api/cron/lesson-reminders` | каждую 1 мин |
| Закрытие прошедших мероприятий + автовыкладывание (сдвиг даты) | `GET /api/cron/expire-events` | каждый час (после полуночи сдвигает `repeatDaily`) |

## VPS (crontab)

```bash
CRON_SECRET='ваш_секрет'
APP='https://твойтренер.рф'

*/5 * * * * curl -fsS "$APP/api/cron/expire-orders?secret=$CRON_SECRET" >/dev/null
* * * * * curl -fsS "$APP/api/cron/lesson-reminders?secret=$CRON_SECRET" >/dev/null
0 * * * * curl -fsS "$APP/api/cron/expire-events?secret=$CRON_SECRET" >/dev/null
```

## Windows (локально / Docker :3001)

```powershell
.\scripts\setup-cron.ps1
```

## Резервное копирование БД

```powershell
.\scripts\backup-postgres.ps1
```

Хранятся последние 7 дней в `backups/postgres/`.
