# Channel bot (webhook bridge)

Принимает outbound-хуки сайта (`skiinstruct/BOT_API.md`) и публикует посты в Telegram-канал.

В Docker: `http://channel-bot:8787` — сайт шлёт сюда без публичного URL.

```http
POST /hooks/instructor-approved
POST /hooks/instructor-online
POST /hooks/event-published
Authorization: Bearer <BOT_API_SECRET>
```

Нужно: бот — админ канала `@tvoitrenerrf`.

## Telegram с РФ-VPS

Прямой DNS `api.telegram.org` часто таймаутит. В `docker-compose` для `channel-bot` задан:

```yaml
extra_hosts:
  - "api.telegram.org:149.154.167.220"
```

и `NODE_OPTIONS=--dns-result-order=ipv4first`. Если IP перестанет отвечать — обновить pin (см. док бота / `getent ahostsv4`).
