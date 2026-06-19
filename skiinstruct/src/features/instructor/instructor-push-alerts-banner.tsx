"use client";

import { BellRing } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { enableInstructorOfflineAlerts } from "@/features/instructor/instructor-panel-shell";
import {
  isWebPushAvailable,
  syncWebPushSubscription,
} from "@/features/push/web-push-client";
import { Button } from "@/shared/ui/button";

type PushState = "loading" | "unsupported" | "denied" | "needs-permission" | "needs-sync" | "ready";

async function detectPushState(): Promise<PushState> {
  if (!isWebPushAvailable()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "needs-permission";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "ready" : "needs-sync";
  } catch {
    return "needs-sync";
  }
}

/** Напоминание включить push — заявки при закрытом сайте. */
export function InstructorPushAlertsBanner() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    setState(await detectPushState());
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
      if (window.sessionStorage.getItem("instructor_push_banner_dismissed_v1") === "1") {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (dismissed || state === "loading" || state === "ready" || state === "unsupported") {
    return null;
  }

  const onEnable = async () => {
    setBusy(true);
    try {
      if (state === "needs-permission" || state === "needs-sync") {
        const ok = await enableInstructorOfflineAlerts();
        if (ok) {
          toast.success("Push включён — заявки придут со звуком, даже если сайт закрыт");
          setState("ready");
          return;
        }
        if (Notification.permission === "granted") {
          const synced = await syncWebPushSubscription();
          if (synced) {
            toast.success("Push подключён");
            setState("ready");
            return;
          }
        }
        toast.error("Не удалось включить push. Проверьте разрешения браузера.");
        await refresh();
        return;
      }
    } finally {
      setBusy(false);
    }
  };

  const onDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem("instructor_push_banner_dismissed_v1", "1");
    } catch {
      /* ignore */
    }
  };

  const message =
    state === "denied"
      ? "Уведомления заблокированы в браузере — вы не узнаете о заявках, если сайт закрыт. Разрешите их в настройках сайта."
      : "Включите push-уведомления: новые заявки придут со звуком и кнопками «Принять / Отклонить», даже когда вкладка свёрнута или сайт закрыт.";

  return (
    <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <div>
            <p className="font-medium text-amber-950 dark:text-amber-100">Не пропускайте заявки</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">{message}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {state !== "denied" ? (
            <Button type="button" size="sm" variant="accent" disabled={busy} onClick={() => void onEnable()}>
              {busy ? "Подключение…" : "Включить push"}
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
