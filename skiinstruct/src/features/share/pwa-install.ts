export const PWA_HINT_DISMISS_STORAGE_KEY = "skiinstruct_pwa_hint_dismissed_v1";

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
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return "Нажмите «Поделиться» в Safari → «На экран Домой».";
  }
  if (/Android/i.test(navigator.userAgent)) {
    return "В меню браузера (⋮) выберите «Установить приложение» или «Добавить на главный экран».";
  }
  return "Добавьте сайт на главный экран через меню браузера.";
}
