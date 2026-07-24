# Отправка писем через Yandex Cloud Postbox

Замена Beget SMTP (`smtp.beget.com` / `noreply@твойтренер.рф`) на Postbox с From вида `no-reply@твойтренер.рф`.

Postbox — только **исходящая** почта (сброс пароля, уведомления). Читать входящие в ящике нельзя — для этого нужен Яндекс 360.

Официально: [быстрый старт Postbox](https://yandex.cloud/ru/docs/postbox/quickstart).

## 1. Платежный аккаунт и каталог

1. [console.yandex.cloud](https://console.yandex.cloud/) → Billing → аккаунт `ACTIVE` или `TRIAL_ACTIVE`.
2. Выберите (или создайте) каталог — сервисный аккаунт и адрес Postbox должны быть **в одном** каталоге.

## 2. Сервисный аккаунт + ключ SMTP

1. IAM → Сервисные аккаунты → создать `postbox-user`.
2. Роль: `postbox.sender`.
3. Создать **API-ключ** с областью действия `yc.postbox.send`.
4. Сохранить сразу:
   - **ID ключа** → это `SMTP_USER`
   - **секрет** → это `SMTP_PASSWORD`

## 3. Адрес в Cloud Postbox

1. Сервис **Cloud Postbox** → **Создать адрес**.
2. Домен укажите в **punycode** (кириллица часто ломается):

   ```
   xn--b1agaovdpdkd.xn--p1ai
   ```

   (= `твойтренер.рф`)

3. DKIM: **Простая** → Создать.
4. На странице адреса скопируйте **две CNAME** для DKIM.

## 4. DNS у регистратора (reg.ru)

Добавьте записи для зоны `твойтренер.рф` / `xn--b1agaovdpdkd.xn--p1ai`:

| Тип | Имя | Значение |
|-----|-----|----------|
| CNAME | как в Postbox (часто `selector1._domainkey` и `selector2._domainkey`) | значения из консоли Postbox |
| TXT | `@` | `v=spf1 include:_spf.yandex.net include:spf.postbox.yandexcloud.net ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:ваш@ящик` |

Если SPF уже есть — **не** создавайте вторую TXT SPF, допишите `include:spf.postbox.yandexcloud.net` в существующую.

В Postbox дождитесь статуса проверки DKIM = **Success** (до суток из‑за DNS-кэша; можно нажать «Запустить проверку»).

MX для одной только отправки через Postbox **не обязателен**. MX нужен, если позже подключите приём почты (360).

## 5. Переменные в корневом `.env` (Docker)

```env
SKIINSTRUCT_SMTP_HOST=postbox.cloud.yandex.net
SKIINSTRUCT_SMTP_PORT=587
SKIINSTRUCT_SMTP_SECURE=0
SKIINSTRUCT_SMTP_USER=<id_api_ключа>
SKIINSTRUCT_SMTP_PASSWORD=<секрет_api_ключа>
SKIINSTRUCT_SMTP_FROM="ТвойТренер <no-reply@твойтренер.рф>"
SKIINSTRUCT_PASSWORD_RESET_EMAIL_FROM="ТвойТренер <no-reply@твойтренер.рф>"
SKIINSTRUCT_SMTP_REPLY_TO=support@твойтренер.рф
```

Альтернатива порту: `465` + `SKIINSTRUCT_SMTP_SECURE=1` (SMTPS).

После правок:

```powershell
docker compose restart skiinstruct
# или локально:
.\scripts\refresh-skiinstruct-3001.ps1
```

## 6. Проверка

```bash
docker compose exec skiinstruct node scripts/test-smtp.mjs ваш@email.ru
```

Или: `/reset-password` на сайте → письмо должно прийти с From `no-reply@твойтренер.рф`.

Логи: `docker compose logs skiinstruct | grep -i smtp`

## Если агент настраивает за вас

Нужно одно из:

1. OAuth-токен с правом `cloud` / `cloud:auth` в `.env` как `YANDEX_CLOUD_OAUTH_TOKEN`, **или**
2. Уже созданный Postbox + ID/секрет API-ключа + подтверждённый DKIM.

Для правок DNS через API — `REG_RU_USERNAME` + `REG_RU_PASSWORD` (альтернативный пароль API в reg.ru).
