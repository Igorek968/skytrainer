# Договоры для ЮKassa

Готовые HTML-файлы по тексту оферт сайта. Откройте в браузере → Печать → «Сохранить как PDF».

| Файл | Что это | URL на сайте |
|------|---------|--------------|
| `01-agent-dogovor-instruktor.html` | Агентский договор с инструктором (полный текст оферты) | https://твойтренер.рф/oferta-instructor |
| `02-dogovor-klient.html` | Договор бронирования с клиентом | https://твойтренер.рф/oferta |

**Важно для ЮKassa:** по каждому инструктору нужен **заполненный договор** (реквизиты + полный текст оферты + дата акцепта), не только ссылка на оферту.

## Автоматизация (прод)

1. При регистрации / одобрении инструктора заполненный договор уходит на почту `YOOKASSA_DOCS_EMAIL` (fallback: `ADMIN_ALERT_EMAIL` / `SMTP_USER`).
2. Админка `/admin/compliance`: реестр, кнопка «На почту ops», «В ЮKassa ✓», пакет ZIP/CSV.
3. Разовая выгрузка всех уже зарегистрированных:

```powershell
cd skiinstruct
npm run export:yookassa-instructor-contracts -- --out ../scripts/yookassa-docs/agency-registry.csv --contracts-dir ../scripts/yookassa-docs/dogovory-filled
npm run export:yookassa-instructor-contracts -- --notify
```

ЮKassa **не принимает договоры по API** — PDF + CSV прикладываете к обращению в поддержку вручную.
