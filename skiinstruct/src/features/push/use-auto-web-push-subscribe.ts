"use client";

import { useEffect } from "react";

import {
  canRequestWebPushOnThisDevice,
  isIosDevice,
  isWebPushAvailable,
  subscribeWebPush,
  syncWebPushSubscription,
} from "@/features/push/web-push-client";

/**
 * Автоподключение Web Push.
 * На iOS разрешение можно запрашивать только по жесту пользователя —
 * здесь только sync уже выданного permission + subscribe если granted.
 */
export function useAutoWebPushSubscribe(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !isWebPushAvailable() || !canRequestWebPushOnThisDevice()) return;

    const run = async () => {
      try {
        if (typeof Notification === "undefined") return;
        // iOS: нельзя вызывать requestPermission() из useEffect — нужен тап по кнопке.
        if (Notification.permission !== "granted") {
          if (isIosDevice()) return;
          // Android/desktop: мягкий автозапрос (часто ок), иначе баннер.
          if (Notification.permission === "default") {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") return;
          } else {
            return;
          }
        }
        const synced = await syncWebPushSubscription();
        if (!synced) {
          await subscribeWebPush();
        }
      } catch {
        /* ignore */
      }
    };

    void run();
  }, [enabled]);
}
