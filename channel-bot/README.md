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
- логотип **ТвойТренер.рф** водяным знаком внизу слева на фото
- внизу текста: реакции 🔥 ❤️ 🥱 ⛺ 💥 и призыв комментировать
- кнопка **«Подобрать тренера → ТвойТренер.рф»** с UTM
- текст + картинка через **Provod** (`PROVOD_API_KEY` / `IMAGE_MODEL`)

Комментарии в Telegram работают, если у канала включена **группа обсуждения** (настройка канала в TG, не код).

## Telegram с РФ-VPS

Прямой DNS `api.telegram.org` часто таймаутит. В `docker-compose` для `channel-bot` задан:

```yaml
extra_hosts:
  - "api.telegram.org:149.154.167.220"
```

и `NODE_OPTIONS=--dns-result-order=ipv4first`. Если IP перестанет отвечать — обновить pin.
