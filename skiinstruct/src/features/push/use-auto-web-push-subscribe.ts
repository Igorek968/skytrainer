"use client";

import { useEffect } from "react";

import {
  canRequestWebPushOnThisDevice,
  isWebPushAvailable,
  subscribeWebPush,
  syncWebPushSubscription,
} from "@/features/push/web-push-client";

/**
 * Автоподключение Web Push в PWA (Android + iOS Home Screen).
 */
export function useAutoWebPushSubscribe(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !isWebPushAvailable() || !canRequestWebPushOnThisDevice()) return;

    const run = async () => {
      try {
        let perm = Notification.permission;
        if (perm === "default") {
          perm = await Notification.requestPermission();
        }
        if (perm !== "granted") return;
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
