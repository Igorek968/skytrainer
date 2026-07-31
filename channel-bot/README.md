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

Формат постов (как раньше в канале):
- `sendPhoto` + HTML caption (эмодзи, жирный заголовок, совет ⚠️, CTA)
- кнопка **«Подобрать тренера → ТвойТренер.рф»** с UTM
- текст можно обогащать через **Provod** (`PROVOD_API_KEY`)

## Telegram с РФ-VPS

Прямой DNS `api.telegram.org` часто таймаутит. В `docker-compose` для `channel-bot` задан:

```yaml
extra_hosts:
  - "api.telegram.org:149.154.167.220"
```

и `NODE_OPTIONS=--dns-result-order=ipv4first`. Если IP перестанет отвечать — обновить pin.
