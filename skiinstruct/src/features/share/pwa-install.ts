export const PWA_HINT_DISMISS_STORAGE_KEY = "skiinstruct_pwa_hint_dismissed_v2";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaPlatform = "android" | "ios" | "desktop";

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

export function isMobileDevice(): boolean {
  return isAndroidDevice() || isIosDevice();
}

export function getPwaPlatform(): PwaPlatform {
  if (isIosDevice()) return "ios";
  if (isAndroidDevice()) return "android";
  return "desktop";
}

export function shouldOfferPwaInstall(): boolean {
  return isMobileDevice() && !isStandaloneDisplay();
}

export function isPwaHintDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(PWA_HINT_DISMISS_STORAGE_KEY) === "1";
}

export function dismissPwaHint(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PWA_HINT_DISMISS_STORAGE_KEY, "1");
}

export function pwaInstallInstructions(): string {
  const platform = getPwaPlatform();
  if (platform === "ios") {
    return "На iPhone/iPad откройте сайт в Safari → «Поделиться» → «На экран „Домой“».";
  }
  if (platform === "android") {
    return "В меню браузера (⋮) выберите «Установить приложение» или «Добавить на главный экран».";
  }
  return "Добавьте сайт на главный экран через меню браузера.";
}

export function pwaInstallSteps(): string[] {
  const platform = getPwaPlatform();
  if (platform === "ios") {
    return [
      "Откройте сайт в Safari (в Chrome на iOS установка может быть недоступна).",
      "Нажмите кнопку «Поделиться» внизу экрана.",
      "Пролистайте и выберите «На экран „Домой“».",
      "Подтвердите «Добавить» — появится иконка ТвойТренер.",
    ];
  }
  if (platform === "android") {
    return [
      "Дождитесь кнопки «Установить» на сайте или откройте меню браузера (⋮).",
      "Выберите «Установить приложение» / «Добавить на главный экран».",
      "Подтвердите установку — ярлык появится рядом с другими приложениями.",
      "В Яндекс.Браузере: меню → «Добавить на домашний экран» / «Установить».",
    ];
  }
  return ["Откройте меню браузера и добавьте сайт на главный экран."];
}
