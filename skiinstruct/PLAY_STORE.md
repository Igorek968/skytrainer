# Публикация Utrainer в Google Play

Сайт подготовлен как **PWA + TWA**: в Play загружается Android-обёртка, контент — ваш прод на HTTPS.

## Что уже сделано в коде

- `public/manifest.webmanifest` — полный манифест (иконки, shortcuts, `start_url: /client`)
- PNG-иконки: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
- `public/sw.js` — service worker (push, офлайн-навигация по клику)
- Регистрация SW при каждом визите (`PwaServiceWorkerRegister`)
- `GET /.well-known/assetlinks.json` — Digital Asset Links для TWA
- Шаблон `android-twa/twa-manifest.json` — package `ru.utrainer.app`

## Перед публикацией на проде

1. **HTTPS** и боевой домен (`NEXT_PUBLIC_APP_URL`, `AUTH_URL`)
2. Юридические страницы: `/privacy`, `/oferta`
3. В `.env` на сервере после сборки Android:

```env
ANDROID_PACKAGE_NAME=ru.utrainer.app
ANDROID_SHA256_FINGERPRINTS=ВАШ_SHA256_ИЗ_BUBBLEWRAP
```

Проверка: откройте `https://ваш-домен/.well-known/assetlinks.json` — должен быть JSON с `package_name` и отпечатком.

## Шаг 1. Иконки (при смене логотипа)

```powershell
cd skiinstruct
npm run pwa:icons
```

## Шаг 2. Собрать Android AAB

```powershell
npm install -g @bubblewrap/cli
cd android-twa
bubblewrap update --manifest=https://utrainer.ru/manifest.webmanifest
bubblewrap build
bubblewrap fingerprint list
```

Скопируйте SHA-256 → `ANDROID_SHA256_FINGERPRINTS` на проде → перезапуск skiinstruct.

AAB: `android-twa/app/build/outputs/bundle/release/app-release.aab`

## Шаг 3. Google Play Console

1. [play.google.com/console](https://play.google.com/console) — создать приложение **Utrainer**
2. **Store listing**: описание, скриншоты (мин. 2), иконка 512×512, feature graphic 1024×500
3. **App content**:
   - Privacy policy: `https://utrainer.ru/privacy`
   - Content rating (анкета IARC)
   - Data safety (геолокация, аккаунт, платежи)
   - App access — тестовый логин, если нужен вход
4. **Release** → Internal testing → загрузить `app-release.aab`
5. После проверки → Production → Send for review

## Шаг 4. Карточка магазина (текст-черновик)

**Краткое описание (до 80 символов):**  
Инструкторы рядом: карта, бронь и оплата тренировок онлайн.

**Полное описание:**  
Utrainer — маркетплейс персональных тренировок. Найдите инструктора на карте по виду спорта и цене, забронируйте занятие и оплатите через ЮKassa. Для инструкторов — заявки, расписание и выплаты в одном кабинете.

**Категория:** Спорт  
**Email поддержки:** из `NEXT_PUBLIC_SUPPORT_EMAIL`

## Data safety (ориентир)

| Данные | Зачем |
|--------|--------|
| Email, имя | Аккаунт, заказы |
| Геолокация | Карта, поиск инструкторов рядом |
| Платёжные данные | Обрабатывает ЮKassa (не хранятся в приложении) |

## Обновления

| Изменение | Действие |
|-----------|----------|
| Сайт, API, дизайн | Деплой skiinstruct |
| Иконка, splash, package, версия Android | Новый AAB в Play |

## Полезные ссылки

- [Digital Asset Links](https://developers.google.com/digital-asset-links)
- [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
- [TWA overview](https://developer.chrome.com/docs/android/trusted-web-activity)
