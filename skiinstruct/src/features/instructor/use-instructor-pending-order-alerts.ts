"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { playInstructorOrderBeep } from "@/features/instructor/instructor-order-beep";
import { orderRelaxedInstructorTiming } from "@/shared/lib/order-flex";

export type PendingOrderAlertRow = {
  id: string;
  status: string;
  flexibleInstructorInvite?: boolean;
  requestedDays?: number | null;
  requestedStartDate?: string | Date | null;
  pendingExpiresAt?: string | Date | null;
  client?: { name: string | null } | null;
};

function timingInput(o: PendingOrderAlertRow) {
  return {
    flexibleInstructorInvite: Boolean(o.flexibleInstructorInvite),
    requestedDays: o.requestedDays ?? null,
    requestedStartDate: o.requestedStartDate ?? null,
  };
}

/**
 * Toast + звук + браузерное уведомление (дополнение к модалке в layout).
 */
export function useInstructorPendingOrderAlerts(
  orders: PendingOrderAlertRow[] | undefined,
  options?: { suppress?: boolean },
) {
  const initializedRef = useRef(false);
  const notifiedPendingIdsRef = useRef<Set<string>>(new Set());
  const storageReadyRef = useRef(false);

  const readPersistedNotified = (): Set<string> => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = window.sessionStorage.getItem("instructor_notified_pending_ids_v1");
      if (!raw) return new Set<string>();
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return new Set<string>();
      return new Set(arr.filter((v): v is string => typeof v === "string"));
    } catch {
      return new Set<string>();
    }
  };

  const writePersistedNotified = (ids: Set<string>) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        "instructor_notified_pending_ids_v1",
        JSON.stringify([...ids]),
      );
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!orders) return;
    if (options?.suppress) return;
    if (!storageReadyRef.current) {
      notifiedPendingIdsRef.current = readPersistedNotified();
      storageReadyRef.current = true;
    }
    const pending = orders.filter((o) => {
      if (o.status !== "PENDING_INSTRUCTOR") return false;
      const relaxed = orderRelaxedInstructorTiming(timingInput(o));
      if (relaxed) return true;
      if (!o.pendingExpiresAt) return false;
      const expMs = new Date(o.pendingExpiresAt).getTime();
      return Number.isFinite(expMs) && expMs > Date.now();
    });
    let newlySeen: PendingOrderAlertRow[] = [];

    if (!initializedRef.current) {
      for (const o of pending) notifiedPendingIdsRef.current.add(o.id);
      writePersistedNotified(notifiedPendingIdsRef.current);
      initializedRef.current = true;
      return;
    }
    newlySeen = pending.filter((o) => !notifiedPendingIdsRef.current.has(o.id));
    for (const o of pending) notifiedPendingIdsRef.current.add(o.id);
    writePersistedNotified(notifiedPendingIdsRef.current);

    if (!newlySeen.length) return;

    playInstructorOrderBeep();

    const rowRelaxed = (o: PendingOrderAlertRow) => orderRelaxedInstructorTiming(timingInput(o));
    const anyRelaxed = newlySeen.some((o) => rowRelaxed(o));
    const anyTimed = newlySeen.some((o) => !rowRelaxed(o));
    const first = newlySeen[0];
    const openFirstOrder = () => {
      if (typeof window === "undefined") return;
      window.location.href = `/instructor/orders/${first.id}`;
    };

    const description =
      anyRelaxed && anyTimed
        ? "Есть срочные (60 с) и спокойные заявки (не сегодня, несколько дней или запись на дату)."
        : anyRelaxed
          ? "Без отсчёта 60 с — урок не сегодня, несколько дней или запись на дату."
          : "На принятие — 60 секунд. Без ответа заявка закрывается.";

    toast.success(`Новая заявка: ${newlySeen.length} шт.`, {
      description,
      action:
        newlySeen.length === 1
          ? {
              label: "Открыть",
              onClick: openFirstOrder,
            }
          : undefined,
    });

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const firstRelaxed = rowRelaxed(first);
      const etaHint =
        !firstRelaxed && first.pendingExpiresAt
          ? (() => {
              const ms = new Date(first.pendingExpiresAt).getTime() - Date.now();
              const leftSec = Math.max(0, Math.ceil(ms / 1000));
              return `На решение: ~${leftSec} сек.`;
            })()
          : "";
      const n = new Notification("Заявка инструктору", {
        body:
          newlySeen.length > 1
            ? "Есть новые заявки. Откройте раздел «Заказы»."
            : [
                first.client?.name ? `Клиент: ${first.client.name}` : "Новый заказ",
                firstRelaxed
                  ? "Без таймера 60 с."
                  : etaHint || "На принятие — 60 секунд.",
              ]
                .filter(Boolean)
                .join(" "),
      });
      n.onclick = () => openFirstOrder();
    }
  }, [orders, options?.suppress]);
}
