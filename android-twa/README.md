# Android TWA (Google Play)

Обёртка для публикации PWA Utrainer в Google Play через [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).

## Требования

- Node.js 18+
- JDK 17+
- [Android Studio](https://developer.android.com/studio) (Android SDK)
- Аккаунт [Google Play Console](https://play.google.com/console) ($25)

## Быстрый старт

Из корня репозитория:

```powershell
npm install -g @bubblewrap/cli
cd android-twa
bubblewrap update --manifest=https://utrainer.ru/manifest.webmanifest
bubblewrap build
```

При первом `update`/`init` укажите тот же `packageId`: **ru.utrainer.app**.

После `build` скопируйте SHA-256 отпечаток:

```powershell
bubblewrap fingerprint list
```

## Переменные на проде (skiinstruct)

В `.env` на сервере:

```env
ANDROID_PACKAGE_NAME=ru.utrainer.app
ANDROID_SHA256_FINGERPRINTS=AA:BB:CC:...
```

Несколько отпечатков (upload + Play App Signing) — через запятую.

Проверка: `https://utrainer.ru/.well-known/assetlinks.json`

Инструмент Google: https://developers.google.com/digital-asset-links/tools/generator

## Сборка AAB для Play

```powershell
cd android-twa
bubblewrap build
```

Файл для загрузки:

`android-twa/app/build/outputs/bundle/release/app-release.aab`

## Keystore

Файл `android.keystore` **не коммитить**. Храните пароли в менеджере паролей. Без keystore нельзя выпускать обновления в Play.

## Обновление версии

1. Поднимите `appVersionCode` и `appVersionName` в `twa-manifest.json`.
2. `bubblewrap update` → `bubblewrap build`.
3. Загрузите новый AAB в Play Console.

Изменения только на сайте (UI, API) **не требуют** нового релиза в Play — достаточно деплоя skiinstruct.

## Подробная инструкция

См. `skiinstruct/PLAY_STORE.md`.
