export const PWA_HINT_DISMISS_STORAGE_KEY = "skiinstruct_pwa_hint_dismissed_v1";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
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
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
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
  if (typeof navigator === "undefined") {
    return "Добавьте сайт на главный экран через меню браузера.";
  }
  if (isIosDevice()) {
    return "Нажмите «Поделиться» в Safari → «На экран Домой».";
  }
  if (/Android/i.test(navigator.userAgent)) {
    return "В меню браузера (⋮) выберите «Установить приложение» или «Добавить на главный экран».";
  }
  return "Добавьте сайт на главный экран через меню браузера.";
}
