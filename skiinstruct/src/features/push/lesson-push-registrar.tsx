"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { isWebPushAvailable, syncWebPushSubscription } from "@/features/push/web-push-client";

/**
 * Тихая синхронизация Web Push, если браузер уже выдал разрешение.
 * Плавающее окно убрано: его нельзя было закрыть, пока подписка не удавалась,
 * а в кабинетах уже есть баннер и кнопка «Включить уведомления».
 */
export function LessonPushRegistrar() {
  const { status, data: session } = useSession();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setSynced(false);
  }, [session?.user?.id]);

  const syncExisting = useCallback(async () => {
    if (!isWebPushAvailable() || status !== "authenticated") return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (synced) return;
    const ok = await syncWebPushSubscription();
    if (ok) setSynced(true);
  }, [status, synced]);

  useEffect(() => {
    void syncExisting();
  }, [syncExisting]);

  return null;
}
