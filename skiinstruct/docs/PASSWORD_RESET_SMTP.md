# Сброс пароля по email (SMTP Beget)

Письмо уходит **на email пользователя из регистрации** (поле при запросе на `/reset-password`).

## Переменные (корневой `.env` → Docker `skiinstruct`)

```env
SKIINSTRUCT_PUBLIC_APP_URL=https://utrainer.ru
SKIINSTRUCT_AUTH_URL=https://utrainer.ru
SKIINSTRUCT_PASSWORD_RESET_DEBUG=0

SKIINSTRUCT_SMTP_HOST=smtp.beget.com
SKIINSTRUCT_SMTP_PORT=465
SKIINSTRUCT_SMTP_SECURE=1
SKIINSTRUCT_SMTP_USER=noreply@utrainer.ru
SKIINSTRUCT_SMTP_PASSWORD=пароль_ящика_из_beget

SKIINSTRUCT_PASSWORD_RESET_EMAIL_FROM="uTrainer <noreply@utrainer.ru>"
SKIINSTRUCT_PASSWORD_RESET_EMAIL_SUBJECT="uTrainer: восстановление пароля"
```

После правок: `docker compose restart skiinstruct` (или `refresh-skiinstruct-3001.ps1` локально).

## Проверка

1. Пользователь с email + паролем в БД.
2. https://utrainer.ru/reset-password → ввести email → письмо на этот ящик.
3. Логи: `docker compose logs skiinstruct | grep password-reset`

## Локально без SMTP

`SKIINSTRUCT_PASSWORD_RESET_DEBUG=1` — на странице показывается ссылка сброса (без письма).
