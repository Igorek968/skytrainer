"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function postSubscription(sub: PushSubscription): Promise<boolean> {
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
  const res = await fetch("/api/me/push-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: j.endpoint,
      keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
    }),
  });
  return res.ok;
}

/**
 * Регистрация Web Push (VAPID): напоминания за ~1 мин до урока и по окончании (см. cron lesson-reminders).
 */
export function LessonPushRegistrar() {
  const { status, data: session } = useSession();
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
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
    if (!vapid || status !== "authenticated" || typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    if (Notification.permission !== "granted") return;
    if (synced) return;
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await reg.update().catch(() => {});
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const ok = await postSubscription(sub);
        if (ok) setSynced(true);
      }
    } catch {
      /* ignore */
    }
  }, [status, vapid, synced]);

  useEffect(() => {
    void syncExisting();
  }, [syncExisting]);

  if (!vapid || status !== "authenticated") return null;
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return null;
  if (perm === "unsupported" || perm === "denied") return null;
  if (synced) return null;

  const onEnable = async () => {
    if (!vapid) return;
    setBusy(true);
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== "granted") return;
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await reg.update().catch(() => {});
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      }
      const ok = await postSubscription(sub);
      if (ok) setSynced(true);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg border border-border bg-background p-3 text-xs shadow-lg">
      <p className="font-medium">Напоминания об уроке</p>
      <p className="mt-1 text-muted-foreground">
        За ~1 мин до начала и после планового конца — push (звук/вибрация по настройкам устройства). Нажмите, чтобы
        разрешить уведомления и подписаться.
      </p>
      <Button type="button" size="sm" className="mt-2" disabled={busy} onClick={() => void onEnable()}>
        {perm === "granted" ? "Подключить к серверу" : "Включить push"}
      </Button>
    </div>
  );
}
