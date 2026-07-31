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
