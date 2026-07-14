"use client";

import { useEffect } from "react";

import { syncWebPushSubscription } from "@/features/push/web-push-client";
import { capturePwaInstallPrompt } from "@/features/share/pwa-install";

/** Регистрирует SW при первом визите — нужно для PWA, push и TWA в Google Play. */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    const stopCapture = capturePwaInstallPrompt();

    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return stopCapture;
    }

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        await reg.update().catch(() => {});
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch {
        /* ignore */
      }
    };

    void register();

    const onControllerChange = () => {
      void syncWebPushSubscription().catch(() => {});
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      stopCapture();
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
