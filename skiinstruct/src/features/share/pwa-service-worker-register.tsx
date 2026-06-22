"use client";

import { useEffect } from "react";

/** Регистрирует SW при первом визите — нужно для PWA, push и TWA в Google Play. */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return null;
}
