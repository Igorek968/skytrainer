"use client";

import { useEffect } from "react";

import { syncWebPushSubscription } from "@/features/push/web-push-client";

/** Регистрирует SW при первом визите — нужно для PWA, push и TWA в Google Play. */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await reg.update().catch(() => {});
      } catch {
        /* ignore */
      }
    };

    void register();

    const onControllerChange = () => {
      void syncWebPushSubscription().catch(() => {});
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
