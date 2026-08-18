"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import {
  isWebPushAvailable,
  subscribeWebPush,
  syncWebPushSubscription,
} from "@/features/push/web-push-client";
import { Button } from "@/shared/ui/button";

/**
 * Регистрация Web Push (VAPID): напоминания за ~1 ч до урока/события и по окончании урока.
 */
export function LessonPushRegistrar() {
  const { status, data: session } = useSession();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setSynced(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
  }, []);

  const syncExisting = useCallback(async () => {
    if (!isWebPushAvailable() || status !== "authenticated") return;
    if (Notification.permission !== "granted") return;
    if (synced) return;
    const ok = await syncWebPushSubscription();
    if (ok) setSynced(true);
  }, [status, synced]);

  useEffect(() => {
    void syncExisting();
  }, [syncExisting]);

  if (!isWebPushAvailable() || status !== "authenticated") return null;
  if (perm === "unsupported" || perm === "denied") return null;
  if (synced) return null;

  const onEnable = async () => {
    setBusy(true);
    try {
      const ok = await subscribeWebPush();
      if (ok) {
        setPerm("granted");
        setSynced(true);
      } else if (typeof window !== "undefined" && "Notification" in window) {
        setPerm(Notification.permission);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg border border-border bg-background p-3 text-xs shadow-lg">
      <p className="font-medium">Напоминания об уроках и событиях</p>
      <p className="mt-1 text-muted-foreground">
        За ~1 час до начала и после планового конца урока — push (звук/вибрация по настройкам устройства). Нажмите,
        чтобы разрешить уведомления и подписаться.
      </p>
      <Button type="button" size="sm" className="mt-2" disabled={busy} onClick={() => void onEnable()}>
        {perm === "granted" ? "Подключить к серверу" : "Включить push"}
      </Button>
    </div>
  );
}
