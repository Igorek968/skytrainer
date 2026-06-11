# Чеклист перед коммерческим запуском

Отмечайте по мере выполнения.

## Срочно (до приёма реальных денег)

- [ ] **ЮKassa** — см. `PAYMENTS_YOOKASSA.md` (shopId, ключ, webhook, return URL)
- [ ] Отключить mock-оплату на проде: `ALLOW_MOCK_CHECKOUT=0`, реальные ключи
- [ ] **MAX поддержка** — `MAX_BOT_TOKEN` + `MAX_SUPPORT_USER_ID` (или `MAX_SUPPORT_CHAT_ID`), `docker compose up -d --force-recreate skiinstruct`
- [ ] **HTTPS** + `SKIINSTRUCT_AUTH_URL` / `SKIINSTRUCT_PUBLIC_APP_URL` = боевой домен
- [ ] **Cron**: `GET /api/cron/expire-orders`, `lesson-reminders` с `SKIINSTRUCT_CRON_SECRET`

## Юридические документы

- [ ] Согласовать с юристом финальный текст: `/oferta`, `/oferta-instructor`, `/privacy`, `/returns`
- [ ] `NEXT_PUBLIC_LEGAL_ENTITY_NAME` — ООО/ИП, ИНН на проде
- [x] Раздельные документы: клиент `/oferta`, инструктор `/oferta-instructor`
- [x] Автовозвраты: полный до принятия инструктором; после принятия — невозвратно (клиент); опоздание 15 мин; штраф инструктора 30% — **ЮKassa refunds в коде**
- [x] Документы инструктора (НПД/ИП, страхование), чек НПД после урока, срок выплат в БД
- [ ] Применить миграцию: `npm run db:migrate` или `npm run db:push` в `skiinstruct/`

## Продукт и качество

- [ ] Прогон сценариев: гость → заказ → оплата; клиент — заказы и ETA; инструктор — онлайн, гео, принятие; админ — модерация и выплаты
- [ ] SMS OTP: `SMS_OTP_DEBUG=0` + Twilio или webhook на проде
- [ ] Резервное копирование PostgreSQL
- [ ] Мониторинг ошибок (Sentry или аналог)

## Поддержка

- [ ] `SUPPORT_SETUP.md` — MAX webhook на HTTPS (ответы оператора Reply → веб-чат)
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_MAX_URL`

## Инфраструктура

- [ ] Секреты только в `.env` на сервере, не в git
- [ ] Перевыпустить токены, если светились в чате (BotFather, ЮKassa, AUTH_SECRET)
- [ ] Домен, почта для уведомлений, FCM при push

## После запуска (первая неделя)

- [ ] Проверить первые 5–10 реальных заказов end-to-end
- [ ] Собрать обратную связь инструкторов (карта, фильтры, длительности)
- [ ] Аналитика: конверсия карта → оплата → принятие инструктором

> Напоминание: юрист + `NEXT_PUBLIC_LEGAL_ENTITY_NAME` (зафиксировано 21.05.2026).
