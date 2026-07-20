"use client";

import { BellRing, Share } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getWebPushUiMode,
  isWebPushAvailable,
  subscribeWebPush,
  syncWebPushSubscription,
  type WebPushUiMode,
} from "@/features/push/web-push-client";
import { Button } from "@/shared/ui/button";

type Props = {
  /** Короткий контекст: кабинет инструктора / клиента */
  audience?: "instructor" | "client";
  className?: string;
};

async function resolveMode(): Promise<WebPushUiMode> {
  const mode = getWebPushUiMode();
  if (mode !== "ready") return mode;
  if (!isWebPushAvailable()) return mode;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "ready" : "can-enable";
  } catch {
    return "can-enable";
  }
}

/**
 * Баннер включения push. На iPhone без «На экран Домой» показывает инструкцию
 * (иначе API уведомлений недоступен и кнопка пропадала).
 *
 * Кнопки «Ответить / Отложить» в push на iOS Apple не поддерживает — только открытие по тапу.
 */
export function PushEnableBanner({ audience = "instructor", className }: Props) {
  const [mode, setMode] = useState<WebPushUiMode | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const storageKey =
    audience === "instructor" ? "instructor_push_banner_dismissed_v2" : "client_push_banner_dismissed_v2";

  const refresh = useCallback(async () => {
    setMode(await resolveMode());
  }, []);

  useEffect(() => {
    void refresh();
    if (typeof window === "undefined") return;
    const onVis = () => void refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(storageKey) === "1") setDismissed(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  if (dismissed || mode === "loading" || mode === "ready" || mode === "no-vapid") {
    return null;
  }

  const onEnable = async () => {
    setBusy(true);
    try {
      const ok = await subscribeWebPush();
      if (ok) {
        toast.success(
          audience === "instructor"
            ? "Уведомления включены — заявки и сообщения придут даже при закрытом приложении"
            : "Уведомления включены",
        );
        setMode("ready");
        return;
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const synced = await syncWebPushSubscription();
        if (synced) {
          toast.success("Push подключён");
          setMode("ready");
          return;
        }
      }
      toast.error("Не удалось включить. Откройте приложение с экрана «Домой» и разрешите уведомления.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  };

  if (mode === "needs-ios-homescreen") {
    return (
      <div
        className={
          className ??
          "mb-4 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm"
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-2">
            <Share className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
            <div>
              <p className="font-medium text-sky-950 dark:text-sky-100">Уведомления на iPhone</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sky-950/90 dark:text-sky-100/90">
                <li>
                  Нажмите «Поделиться» <span className="whitespace-nowrap">(□↑)</span> внизу Safari
                </li>
                <li>Выберите «На экран „Домой“»</li>
                <li>Откройте ярлык и нажмите «Включить уведомления»</li>
              </ol>
              <p className="mt-2 text-xs text-sky-900/80 dark:text-sky-100/70">
                На iOS нельзя ответить прямо из уведомления (ограничение Apple) — нажмите на него, чтобы
                открыть чат. Работает iOS 16.4 и новее.
              </p>
            </div>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Скрыть
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "unsupported") {
    return (
      <div
        className={
          className ??
          "mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
        }
      >
        <p>
          Этот браузер не поддерживает push-уведомления. На iPhone откройте сайт в Safari и добавьте на
          экран «Домой».
        </p>
        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={onDismiss}>
          Скрыть
        </Button>
      </div>
    );
  }

  const message =
    mode === "denied"
      ? "Уведомления заблокированы. Настройки → уведомления → ТвойТренер → разрешите."
      : audience === "instructor"
        ? "Включите уведомления: заявки и сообщения придут со звуком, даже когда приложение закрыто."
        : "Включите уведомления, чтобы не пропускать сообщения и напоминания.";

  return (
    <div className={className ?? "mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <div>
            <p className="font-medium text-amber-950 dark:text-amber-100">Не пропускайте сообщения</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">{message}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {mode !== "denied" ? (
            <Button type="button" size="sm" variant="accent" disabled={busy} onClick={() => void onEnable()}>
              {busy ? "Подключение…" : "Включить уведомления"}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Скрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
