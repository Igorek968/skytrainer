/**
 * PWA install helpers for RU mobile browsers.
 * Priority market (StatCounter / LiveInternet RU): Chrome, Safari, Yandex, Opera, Samsung, Firefox, MIUI.
 */

export const PWA_HINT_DISMISS_STORAGE_KEY = "skiinstruct_pwa_hint_dismissed_v6";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaPlatform = "android" | "ios" | "desktop";

/** Браузеры, важные для RU смартфонов. */
export type MobileBrowserKind =
  | "chrome"
  | "yandex"
  | "safari"
  | "samsung"
  | "opera"
  | "firefox"
  | "edge"
  | "miui"
  | "other";

export type InstallStrategy =
  /** Chrome / Samsung / Opera / Edge: системный beforeinstallprompt. */
  | "native_prompt"
  /** Яндекс и др.: только ручные шаги (иначе часто закладка). */
  | "manual_steps"
  /** iOS не-Safari: установка только через Safari. */
  | "safari_required"
  /** Telegram / VK / Instagram WebView: PWA из встроенного браузера не ставится. */
  | "external_browser";

export type PwaInstallGuide = {
  browser: MobileBrowserKind;
  platform: PwaPlatform;
  strategy: InstallStrategy;
  browserLabel: string;
  title: string;
  description: string;
  steps: string[];
  footnote: string | null;
  /** Показывать системную кнопку «Установить», если есть deferred prompt. */
  useNativePrompt: boolean;
};

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<Listener>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function setDeferredInstallPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  notifyListeners();
}

export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Перехватывает системный beforeinstallprompt — вызывать один раз на уровне приложения. */
export function capturePwaInstallPrompt(): () => void {
  if (typeof window === "undefined") return () => {};

  const onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
  };

  const onAppInstalled = () => {
    setDeferredInstallPrompt(null);
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);

  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
  };
}

/** Показывает системный диалог установки PWA. Возвращает true, если диалог открылся. */
export async function promptPwaInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;

  setDeferredInstallPrompt(null);
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Встроенный браузер мессенджера / соцсети: Chrome не показывает установку PWA.
 * Типичный сценарий: ссылка из Telegram / VK / Instagram.
 */
export function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const s = navigator.userAgent;
  if (/Telegram|TelegramWebview/i.test(s)) return true;
  if (/Instagram/i.test(s)) return true;
  if (/FBAN|FBAV|FB_IAB|FBAN\//i.test(s)) return true;
  if (/WhatsApp/i.test(s)) return true;
  if (/VKAndroidApp|vk_app|VKiOS|VK\/\d/i.test(s)) return true;
  if (/Line\//i.test(s)) return true;
  if (/; wv\)/i.test(s) && /Android/i.test(s)) return true;
  return false;
}

export function isMobileDevice(): boolean {
  return isAndroidDevice() || isIosDevice();
}

export function shouldOfferPwaInstall(): boolean {
  if (isStandaloneDisplay()) return false;
  if (isInAppBrowser()) return true;
  return isMobileDevice();
}

export function getPwaPlatform(): PwaPlatform {
  if (isIosDevice()) return "ios";
  if (isAndroidDevice()) return "android";
  return "desktop";
}

export function isPwaHintDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(PWA_HINT_DISMISS_STORAGE_KEY) === "1";
}

export function dismissPwaHint(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PWA_HINT_DISMISS_STORAGE_KEY, "1");
}

function ua(): string {
  return typeof navigator !== "undefined" ? navigator.userAgent : "";
}

/** Яндекс.Браузер (Android / iOS / desktop). */
export function isYandexBrowser(): boolean {
  return /YaBrowser|YaSearchBrowser/i.test(ua());
}

/** Настоящий Safari на iOS (не Chrome/Яндекс/Opera поверх WebKit). */
export function isIosSafari(): boolean {
  if (!isIosDevice()) return false;
  const s = ua();
  // Сторонние браузеры на iOS оставляют свои маркеры.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|YaSearchBrowser|DuckDuckGo|Brave/i.test(s)) {
    return false;
  }
  return /Safari/i.test(s);
}

/**
 * Детект браузера для RU-аудитории.
 * Порядок важен: сначала узкие маркеры (YaBrowser, SamsungBrowser), потом Chrome.
 */
export function detectMobileBrowser(): MobileBrowserKind {
  const s = ua();

  if (isIosDevice()) {
    if (isYandexBrowser()) return "yandex";
    if (/CriOS/i.test(s)) return "chrome";
    if (/FxiOS/i.test(s)) return "firefox";
    if (/EdgiOS/i.test(s)) return "edge";
    if (/OPiOS|OPT\//i.test(s)) return "opera";
    if (isIosSafari()) return "safari";
    return "other";
  }

  if (isYandexBrowser()) return "yandex";
  if (/SamsungBrowser/i.test(s)) return "samsung";
  if (/MiuiBrowser|XiaoMi\/MiuiBrowser/i.test(s)) return "miui";
  if (/Firefox|Fennec/i.test(s) && !/Seamonkey/i.test(s)) return "firefox";
  if (/EdgA\//i.test(s) || (/Edg\//i.test(s) && isAndroidDevice())) return "edge";
  // Opera Android: OPR/ ; не путать с Opera Mini (плохо для PWA).
  if (/OPR\//i.test(s) || (/Opera/i.test(s) && !/Opera Mini/i.test(s))) return "opera";
  if (/Chrome|CriOS/i.test(s) && !/Chromium|Edg|OPR|SamsungBrowser|YaBrowser/i.test(s)) {
    return "chrome";
  }
  return "other";
}

const BROWSER_LABEL: Record<MobileBrowserKind, string> = {
  chrome: "Google Chrome",
  yandex: "Яндекс.Браузер",
  safari: "Safari",
  samsung: "Samsung Internet",
  opera: "Opera",
  firefox: "Firefox",
  edge: "Microsoft Edge",
  miui: "Mi Браузер",
  other: "браузер",
};

function iosSafariSteps(): string[] {
  return [
    "Откройте этот сайт в Safari (иконка компаса).",
    "Нажмите «Поделиться» (квадрат со стрелкой вверх) внизу экрана.",
    "Пролистайте меню и выберите «На экран „Домой“».",
    "Нажмите «Добавить» — появится иконка «Твой Тренер» как у приложения.",
  ];
}

function iosNonSafariSteps(browserLabel: string): string[] {
  return [
    `Сейчас открыт ${browserLabel}. На iPhone/iPad установить приложение можно только из Safari.`,
    "Скопируйте адрес сайта из строки адреса.",
    "Откройте Safari → вставьте адрес → откройте ТвойТренер.рф.",
    "В Safari: «Поделиться» → «На экран „Домой“» → «Добавить».",
  ];
}

function androidChromeSteps(): string[] {
  return [
    "Нажмите «Установить» ниже — откроется окно Chrome.",
    "Или меню Chrome (⋮) → «Установить приложение» / «Добавить на главный экран».",
    "Подтвердите установку. Иконка появится среди приложений.",
    "Откройте с иконки: без адресной строки — установилось правильно.",
  ];
}

function androidYandexSteps(): string[] {
  return [
    "Меню Яндекс.Браузера (⋮) → пункт «Установить приложение» / «Установить как приложение».",
    "Не выбирайте «Добавить в закладки» и не обычный ярлык сайта — часто получается только вкладка.",
    "После установки откройте иконку: не должно быть умной строки браузера.",
    "Самый надёжный способ в России: открыть сайт в Google Chrome и нажать «Установить».",
  ];
}

function androidSamsungSteps(): string[] {
  return [
    "Нажмите «Установить» ниже, если кнопка активна.",
    "Или меню Samsung Internet (☰ / ⋮) → «Добавить страницу на» → «Главный экран» / «Установить».",
    "Подтвердите. Откройте иконку без адресной строки.",
  ];
}

function androidOperaSteps(): string[] {
  return [
    "Нажмите «Установить» ниже, если доступно.",
    "Или меню Opera (☰) → «Добавить на главный экран» / «Установить».",
    "Выбирайте установку приложения, не закладку.",
    "Если пункта нет — установите из Google Chrome.",
  ];
}

function androidFirefoxSteps(): string[] {
  return [
    "Меню Firefox (⋮) → «Установить» или «Добавить на главный экран».",
    "Подтвердите добавление ярлыка.",
    "Для полноценного приложения без строки браузера лучше Google Chrome.",
  ];
}

function androidEdgeSteps(): string[] {
  return [
    "Нажмите «Установить» ниже, если кнопка активна.",
    "Или меню Edge (⋯) → «Добавить на телефон» / «Установить приложение».",
    "Подтвердите установку.",
  ];
}

function androidMiuiSteps(): string[] {
  return [
    "Меню браузера → «Добавить на главный экран» / «Установить».",
    "Если появляется только ярлык сайта — откройте ТвойТренер.рф в Google Chrome и установите оттуда.",
  ];
}

function androidOtherSteps(): string[] {
  return [
    "Откройте меню браузера (⋮) и найдите «Установить приложение» или «На главный экран».",
    "Не добавляйте в закладки — нужен пункт про установку / домашний экран.",
    "Надёжный вариант для Android в России: Google Chrome → «Установить приложение».",
  ];
}

function inAppBrowserSteps(): string[] {
  const ios = isIosDevice();
  return [
    "Сейчас сайт открыт внутри Telegram, VK или другой программы — оттуда приложение не ставится.",
    ios
      ? "Нажмите «···» или значок Safari / «Открыть в Safari» в меню этого окна."
      : "Нажмите «⋮» (меню) → «Открыть в браузере» / Chrome.",
    ios
      ? "В Safari: «Поделиться» → «На экран „Домой“» → «Добавить»."
      : "В Chrome: меню → «Установить приложение».",
  ];
}

/**
 * Полный гайд установки под текущий браузер (RU Android + iOS).
 */
export function getPwaInstallGuide(canNativeInstall = Boolean(deferredPrompt)): PwaInstallGuide {
  const platform = getPwaPlatform();
  const browser = detectMobileBrowser();
  const browserLabel = BROWSER_LABEL[browser];

  if (isInAppBrowser()) {
    return {
      browser,
      platform,
      strategy: "external_browser",
      browserLabel: "Telegram / VK / Instagram",
      title: "Откройте сайт в браузере",
      description:
        "Из ленты Telegram, VK или Instagram приложение установить нельзя. Нужен Chrome (Android) или Safari (iPhone).",
      steps: inAppBrowserSteps(),
      footnote: "Скопируйте адрес tvoytrener.рф и вставьте в Chrome или Safari.",
      useNativePrompt: false,
    };
  }

  if (platform === "ios") {
    if (browser === "safari") {
      return {
        browser,
        platform,
        strategy: "manual_steps",
        browserLabel,
        title: "Установить на iPhone",
        description: "В Safari добавьте ТвойТренер на экран «Домой» — откроется как приложение.",
        steps: iosSafariSteps(),
        footnote: "На iOS установка работает только через Safari. Chrome и Яндекс на iPhone сами установить PWA не могут.",
        useNativePrompt: false,
      };
    }
    return {
      browser,
      platform,
      strategy: "safari_required",
      browserLabel,
      title: "Нужен Safari",
      description: `Вы в ${browserLabel}. На iPhone/iPad приложение ставится только из Safari.`,
      steps: iosNonSafariSteps(browserLabel),
      footnote: "Скопируйте ссылку и откройте в Safari — там «Поделиться» → «На экран Домой».",
      useNativePrompt: false,
    };
  }

  if (platform === "android") {
    if (browser === "yandex") {
      return {
        browser,
        platform,
        strategy: "manual_steps",
        browserLabel,
        title: "Установить на Android",
        description:
          "В Яндекс.Браузере выбирайте именно «Установить приложение». Закладка или ярлык сайта откроют вкладку, а не приложение.",
        steps: androidYandexSteps(),
        footnote: "Ограничение Яндекс.Браузера, не сайта. В Google Chrome установка стабильно даёт приложение.",
        useNativePrompt: false,
      };
    }

    if (browser === "firefox") {
      return {
        browser,
        platform,
        strategy: "manual_steps",
        browserLabel,
        title: "Установить на Android",
        description: "В Firefox добавьте сайт на главный экран через меню браузера.",
        steps: androidFirefoxSteps(),
        footnote: null,
        useNativePrompt: false,
      };
    }

    if (browser === "miui") {
      return {
        browser,
        platform,
        strategy: canNativeInstall ? "native_prompt" : "manual_steps",
        browserLabel,
        title: "Установить на Android",
        description: "Добавьте ТвойТренер на главный экран Xiaomi / Redmi / POCO.",
        steps: androidMiuiSteps(),
        footnote: canNativeInstall ? null : "Если ярлык открывается во вкладке — поставьте из Google Chrome.",
        useNativePrompt: canNativeInstall,
      };
    }

    const chromiumLike = browser === "chrome" || browser === "samsung" || browser === "opera" || browser === "edge";
    const steps =
      browser === "samsung"
        ? androidSamsungSteps()
        : browser === "opera"
          ? androidOperaSteps()
          : browser === "edge"
            ? androidEdgeSteps()
            : browser === "chrome"
              ? androidChromeSteps()
              : androidOtherSteps();

    return {
      browser,
      platform,
      strategy: canNativeInstall && chromiumLike ? "native_prompt" : "manual_steps",
      browserLabel,
      title: "Установить на Android",
      description: canNativeInstall
        ? `В ${browserLabel} можно установить ТвойТренер как приложение — один шаг.`
        : `В ${browserLabel}: меню → «Установить приложение» или «На главный экран».`,
      steps,
      footnote: canNativeInstall
        ? "После «Установить» браузер покажет системное окно подтверждения."
        : "Проверка: иконка открывается без адресной строки — это приложение, не закладка.",
      useNativePrompt: canNativeInstall && (chromiumLike || browser === "other"),
    };
  }

  // Desktop — на случай узкого окна / редких сценариев
  if (isYandexBrowser()) {
    return {
      browser: "yandex",
      platform: "desktop",
      strategy: "manual_steps",
      browserLabel: BROWSER_LABEL.yandex,
      title: "Установить приложение",
      description: "В Яндекс.Браузере: меню страницы → «Установить как приложение», не закладка.",
      steps: androidYandexSteps(),
      footnote: "На компьютере надёжнее Google Chrome → значок установки в адресной строке.",
      useNativePrompt: false,
    };
  }

  return {
    browser: "other",
    platform: "desktop",
    strategy: canNativeInstall ? "native_prompt" : "manual_steps",
    browserLabel: "браузер",
    title: "Установить приложение",
    description: "Установите ТвойТренер как приложение из меню браузера.",
    steps: [
      "В адресной строке или меню выберите «Установить приложение».",
      "Не добавляйте страницу в закладки.",
    ],
    footnote: null,
    useNativePrompt: canNativeInstall,
  };
}

/** @deprecated используйте getPwaInstallGuide().description */
export function pwaInstallInstructions(): string {
  return getPwaInstallGuide().description;
}

/** @deprecated используйте getPwaInstallGuide().steps */
export function pwaInstallSteps(): string[] {
  return getPwaInstallGuide().steps;
}
