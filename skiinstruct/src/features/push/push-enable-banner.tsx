"use client";

import { BellRing, Share } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getWebPushUiMode,
  isIosDevice,
  isWebPushAvailable,
  subscribeWebPush,
  syncWebPushSubscription,
  type WebPushUiMode,
} from "@/features/push/web-push-client";
import { Button } from "@/shared/ui/button";

type Props = {
  /** Короткий контекст: кабинет инструктора / клиента / админа */
  audience?: "instructor" | "client" | "admin";
  className?: string;
};

/** Браузер уже ответил «запретить» — в кабинете сайта включить нельзя. */
function deniedHelp() {
  if (typeof navigator === "undefined") {
    return {
      lead: "Это не меню кабинета: уведомления запретил браузер.",
      steps: [] as string[],
    };
  }
  if (isIosDevice()) {
    return {
      lead: "Это не пункт кабинета на сайте. Разрешение выдаёт iPhone.",
      steps: [
        "Откройте приложение «Настройки» на телефоне (серая шестерёнка), не меню сайта",
        "Уведомления → найдите «ТвойТренер»",
        "Включите «Допуск уведомлений» и вернитесь в кабинет",
      ],
    };
  }
  if (/Android/i.test(navigator.userAgent || "")) {
    return {
      lead: "Это не пункт кабинета на сайте. Браузер ранее нажал «Блокировать» для твойтренер.рф.",
      steps: [
        "Нажмите замочек слева от адреса сайта",
        "Разрешения → Уведомления → Разрешить",
        "Обновите страницу",
      ],
    };
  }
  return {
    lead: "Это не пункт кабинета на сайте. Браузер ранее запретил уведомления для твойтренер.рф — внутри личного кабинета их включить нельзя.",
    steps: [
      "Нажмите замочек или значок настроек слева от адреса в строке браузера",
      "Уведомления → Разрешить",
      "Обновите страницу",
    ],
  };
}

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
    audience === "admin"
      ? "admin_push_banner_dismissed_v1"
      : audience === "instructor"
        ? "instructor_push_banner_dismissed_v3"
        : "client_push_banner_dismissed_v2";

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
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      // Instructors: dismiss only for 12h — otherwise they hide the banner and never get push on iOS.
      if (audience === "instructor") {
        const until = Number(raw);
        if (Number.isFinite(until) && Date.now() < until) setDismissed(true);
        else window.localStorage.removeItem(storageKey);
        return;
      }
      if (raw === "1") setDismissed(true);
    } catch {
      /* ignore */
    }
  }, [storageKey, audience]);

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
            : audience === "admin"
              ? "Уведомления админа включены — модерация, выплаты и поддержка придут на устройство"
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
      if (audience === "instructor") {
        window.localStorage.setItem(storageKey, String(Date.now() + 12 * 60 * 60 * 1000));
      } else {
        window.sessionStorage.setItem(storageKey, "1");
      }
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
                  В Safari нажмите «Поделиться» <span className="whitespace-nowrap">(□↑)</span>
                </li>
                <li>Выберите «На экран „Домой“» и откройте ярлык</li>
                <li>В кабинете нажмите «Включить уведомления» и разрешите в системном окне</li>
              </ol>
              <p className="mt-2 text-xs text-sky-900/80 dark:text-sky-100/70">
                Без этого шага iPhone не доставляет push (ограничение Apple, iOS 16.4+). Из уведомления
                нельзя ответить кнопкой — только открыть приложение тапом.
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

  const denied = mode === "denied" ? deniedHelp() : null;
  const message =
    audience === "instructor"
      ? "Нажмите «Включить уведомления» и разрешите в системном окне iPhone — иначе заявки на события не придут, пока кабинет закрыт."
      : audience === "admin"
        ? "Включите push: модерация, выплаты, поддержка и претензии — даже когда кабинет закрыт."
        : "Включите уведомления, чтобы не пропускать сообщения и напоминания.";

  return (
    <div className={className ?? "mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <div>
            <p className="font-medium text-amber-950 dark:text-amber-100">
              {denied ? "Уведомления запретил браузер" : "Не пропускайте сообщения"}
            </p>
            {denied ? (
              <>
                <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">{denied.lead}</p>
                {denied.steps.length > 0 ? (
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-amber-900/90 dark:text-amber-100/90">
                    {denied.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">{message}</p>
            )}
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
