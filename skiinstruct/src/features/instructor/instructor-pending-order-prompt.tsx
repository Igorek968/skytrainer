"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { OrderStatus } from "@prisma/client";

import { playInstructorOrderBeep, startInstructorOrderBeepRepeat, stopInstructorOrderBeepRepeat } from "@/features/instructor/instructor-order-beep";
import { instructorAlertPollInterval } from "@/lib/query-poll";
import { fireSiteAlert, siteAlertTitle } from "@/lib/site-alert";
import { useVisibilityInvalidate } from "@/features/push/use-visibility-invalidate";
import {
  dismissPendingPrompt,
  readDismissedPendingPromptIds,
} from "@/lib/instructor-pending-prompt-storage";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  orderRelaxedInstructorTiming,
  orderIsUrgent,
  orderSkipsInstructorEta,
  formatUrgentCountdown,
  urgentDeadlineLabel,
  instructorCanAcceptAfterDeadline,
} from "@/shared/lib/order-flex";
import { isLongInstructorEtaMinutes, LONG_INSTRUCTOR_ETA_MINUTES } from "@/shared/lib/order-long-eta";
import { OrderLessonTimeBlock } from "@/shared/ui/order-lesson-time-block";
import { orderHasMeetAddress, resolveMeetAddress } from "@/shared/lib/order-meet-address";
import { orderStatusLabel } from "@/shared/lib/order-status";

const RECENT_AUTO_ACCEPT_MS = 5 * 60 * 1000;

type PendingOrderRow = {
  id: string;
  status: string;
  createdAt: string;
  acceptedAt?: string | null;
  pendingExpiresAt: string | null;
  flexibleInstructorInvite?: boolean;
  urgentInvite?: boolean;
  amountTotal: string | number | null;
  meetLat: number;
  meetLng: number;
  skillLevel: string;
  languagePref: string;
  duration: string;
  notes: string | null;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  requestedDays: number | null;
  meetAddress?: string | null;
  client: { name: string | null } | null;
};

function orderTimingInput(o: PendingOrderRow) {
  return {
    flexibleInstructorInvite: Boolean(o.flexibleInstructorInvite),
    urgentInvite: Boolean(o.urgentInvite),
    requestedDays: o.requestedDays ?? null,
    requestedStartDate: o.requestedStartDate,
  };
}

function notifyInstructorNewOrder(order: PendingOrderRow) {
  const clientName = order.client?.name?.trim();
  const orderUrl = `/instructor/orders/${order.id}`;
  fireSiteAlert({
    title: siteAlertTitle("новая заявка"),
    body: clientName
      ? `Клиент: ${clientName}. Откройте кабинет инструктора.`
      : "Поступила новая заявка. Откройте кабинет инструктора.",
    sound: "order",
    skipSound: true,
    tag: `instructor-order-${order.id}`,
    url: orderUrl,
    requireInteraction: true,
    toastAction: {
      label: "Открыть",
      onClick: () => {
        window.location.href = orderUrl;
      },
    },
  });
}

function orderNeedsInstructorAlert(o: PendingOrderRow): boolean {
  if (o.status === "PENDING_INSTRUCTOR") {
    const relaxed = orderRelaxedInstructorTiming(orderTimingInput(o));
    const urgent = orderIsUrgent(orderTimingInput(o));
    if (relaxed) return true;
    if (urgent && o.pendingExpiresAt) {
      const expMs = new Date(o.pendingExpiresAt).getTime();
      return Number.isFinite(expMs) && expMs > Date.now();
    }
    if (!o.pendingExpiresAt) return true;
    const expMs = new Date(o.pendingExpiresAt).getTime();
    return Number.isFinite(expMs) && expMs > Date.now();
  }
  if (o.status === "ACCEPTED" && o.acceptedAt) {
    const acceptedMs = new Date(o.acceptedAt).getTime();
    return Number.isFinite(acceptedMs) && Date.now() - acceptedMs <= RECENT_AUTO_ACCEPT_MS;
  }
  return false;
}

function pickNewPendingOrder(
  pending: PendingOrderRow[],
  seenIds: Set<string>,
  dismissed: Set<string>,
): PendingOrderRow | null {
  const candidates = pending.filter((o) => !seenIds.has(o.id) && !dismissed.has(o.id));
  if (candidates.length) return candidates[0]!;
  if (seenIds.size > 0) return null;
  return pending.find((o) => !dismissed.has(o.id)) ?? null;
}

/**
 * Всплывающее окно + звук при новой заявке PENDING_INSTRUCTOR (все страницы кабинета).
 */
export function InstructorPendingOrderPrompt() {
  const router = useRouter();
  const qc = useQueryClient();
  useVisibilityInvalidate([["instructor-order-alerts"]]);
  const [pendingPromptOrderId, setPendingPromptOrderId] = useState<string | null>(null);
  const [etaMinutes, setEtaMinutes] = useState(20);
  const [pendingPromptSecondsLeft, setPendingPromptSecondsLeft] = useState<number | null>(null);
  const [suppress, setSuppress] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const dismissedRef = useRef<Set<string> | null>(null);
  const heldLongEtaRef = useRef<number | null>(null);

  const { data: orderAlerts } = useQuery({
    queryKey: ["instructor-order-alerts"],
    queryFn: async () => {
      const r = await fetch("/api/orders", { credentials: "include" });
      if (!r.ok) throw new Error("orders-alerts");
      return r.json() as Promise<{ orders: PendingOrderRow[] }>;
    },
    refetchInterval: instructorAlertPollInterval(5000),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const onSuppress = () => setSuppress(true);
    const onUnsuppress = () => setSuppress(false);
    window.addEventListener("skiinstruct:suppress-order-prompts", onSuppress);
    window.addEventListener("skiinstruct:unsuppress-order-prompts", onUnsuppress);
    return () => {
      window.removeEventListener("skiinstruct:suppress-order-prompts", onSuppress);
      window.removeEventListener("skiinstruct:unsuppress-order-prompts", onUnsuppress);
    };
  }, []);

  useEffect(() => {
    if (!orderAlerts?.orders || suppress) return;
    if (dismissedRef.current === null) {
      dismissedRef.current = readDismissedPendingPromptIds();
    }
    const dismissed = dismissedRef.current;

    const pending = orderAlerts.orders.filter(orderNeedsInstructorAlert);

    if (!initializedRef.current) {
      initializedRef.current = true;
      const toPrompt = pickNewPendingOrder(pending, seenIdsRef.current, dismissed);
      for (const p of pending) seenIdsRef.current.add(p.id);
      if (toPrompt) {
        playInstructorOrderBeep();
        startInstructorOrderBeepRepeat();
        notifyInstructorNewOrder(toPrompt);
        setPendingPromptOrderId(toPrompt.id);
        setEtaMinutes(20);
      }
      return;
    }

    const newlySeen = pickNewPendingOrder(pending, seenIdsRef.current, dismissed);
    for (const p of pending) seenIdsRef.current.add(p.id);

    if (newlySeen) {
      playInstructorOrderBeep();
      startInstructorOrderBeepRepeat();
      notifyInstructorNewOrder(newlySeen);
      setPendingPromptOrderId(newlySeen.id);
      setEtaMinutes(20);
    }
  }, [orderAlerts?.orders, suppress]);

  const activeOrder =
    orderAlerts?.orders.find(
      (o) => o.id === pendingPromptOrderId && orderNeedsInstructorAlert(o),
    ) ?? null;

  const isAutoAccepted = activeOrder?.status === "ACCEPTED";

  const isUrgent = activeOrder ? orderIsUrgent(orderTimingInput(activeOrder)) : false;
  const relaxedTiming = activeOrder
    ? orderRelaxedInstructorTiming(orderTimingInput(activeOrder))
    : false;
  const skipsEta = activeOrder ? orderSkipsInstructorEta(orderTimingInput(activeOrder)) : false;

  const longEtaPending = !skipsEta && isLongInstructorEtaMinutes(etaMinutes);
  const hasMeetPlace = activeOrder ? orderHasMeetAddress(activeOrder) : false;
  const meetPlaceLabel = activeOrder ? resolveMeetAddress(activeOrder) : null;

  useEffect(() => {
    if (!pendingPromptOrderId || !activeOrder) {
      stopInstructorOrderBeepRepeat();
      return;
    }
    const baseTitle = document.title;
    let on = false;
    const id = window.setInterval(() => {
      on = !on;
      document.title = on ? "⚡ Новая заявка! — Utrainer" : baseTitle;
    }, 900);
    return () => {
      window.clearInterval(id);
      document.title = baseTitle;
      stopInstructorOrderBeepRepeat();
    };
  }, [pendingPromptOrderId, activeOrder?.id]);

  useEffect(() => {
    if (!pendingPromptOrderId) return;
    if (activeOrder) return;
    setPendingPromptOrderId(null);
  }, [activeOrder, pendingPromptOrderId]);

  const holdLongEta = useMutation({
    mutationFn: async (payload: { orderId: string; etaMinutes: number }) => {
      const r = await fetch(`/api/orders/${payload.orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "hold_pending_long_eta", etaMinutes: payload.etaMinutes }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось сохранить время");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!activeOrder || relaxedTiming || longEtaPending) {
      setPendingPromptSecondsLeft(null);
      return;
    }
    if (!isUrgent) {
      setPendingPromptSecondsLeft(null);
      return;
    }
    const expRaw = activeOrder.pendingExpiresAt;
    if (!expRaw) {
      setPendingPromptSecondsLeft(null);
      return;
    }
    const expMs = new Date(expRaw).getTime();
    if (!Number.isFinite(expMs)) {
      setPendingPromptSecondsLeft(null);
      return;
    }
    const tick = () => {
      setPendingPromptSecondsLeft(Math.max(0, Math.ceil((expMs - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeOrder, relaxedTiming, longEtaPending, isUrgent]);

  useEffect(() => {
    if (!activeOrder || relaxedTiming || !longEtaPending) {
      heldLongEtaRef.current = null;
      return;
    }
    if (heldLongEtaRef.current === etaMinutes) return;
    heldLongEtaRef.current = etaMinutes;
    holdLongEta.mutate({ orderId: activeOrder.id, etaMinutes });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when ETA crosses long threshold
  }, [activeOrder?.id, longEtaPending, etaMinutes]);

  useEffect(() => {
    if (!activeOrder || relaxedTiming || longEtaPending) return;
    if (!isUrgent) return;
    const expRaw = activeOrder.pendingExpiresAt;
    if (!expRaw || instructorCanAcceptAfterDeadline(expRaw)) return;
    setPendingPromptOrderId(null);
    setPendingPromptSecondsLeft(null);
    toast.info("Время ответа истекло. Заявка закрыта для клиента.");
    void qc.invalidateQueries({ queryKey: ["instructor-order-alerts"] });
    void qc.invalidateQueries({ queryKey: ["orders"] });
  }, [activeOrder, relaxedTiming, longEtaPending, isUrgent, qc]);

  const respond = useMutation({
    mutationFn: async (payload: { orderId: string; action: "accept" | "reject"; etaMinutes?: number }) => {
      const body =
        payload.action === "accept"
          ? payload.etaMinutes != null && payload.etaMinutes > 0
            ? { action: "accept" as const, etaMinutes: payload.etaMinutes }
            : { action: "accept" as const }
          : { action: "reject" as const };
      const r = await fetch(`/api/orders/${payload.orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось обновить заказ");
      return payload;
    },
    onSuccess: async ({ orderId, action }) => {
      stopInstructorOrderBeepRepeat();
      dismissPendingPrompt(orderId);
      dismissedRef.current = readDismissedPendingPromptIds();
      await qc.invalidateQueries({ queryKey: ["instructor-order-alerts"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      setPendingPromptOrderId(null);
      if (action === "accept") {
        toast.success("Заявка принята");
        router.push(`/instructor/orders/${orderId}`);
      } else {
        toast.success("Заявка отклонена");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!activeOrder || suppress) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructor-new-order-title"
    >
      <div className="max-h-[min(92dvh,640px)] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-xl">
        <h2 id="instructor-new-order-title" className="text-lg font-semibold">
          {isAutoAccepted
            ? "Новая заявка (запись на дату)"
            : isUrgent
              ? "⚡ Срочная заявка"
              : "Новая заявка от клиента"}
        </h2>
        {isAutoAccepted ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Заявка принята автоматически — откройте заказ и уточните детали с клиентом.
          </p>
        ) : null}
        <p className="mt-1 text-sm text-muted-foreground">
          Клиент: {activeOrder.client?.name || "Без имени"}
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-2 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted-foreground">Статус</span>
              <div className="font-medium">
                {orderStatusLabel(activeOrder.status as OrderStatus)}
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Создан</span>
              <div className="font-medium">
                {new Date(activeOrder.createdAt).toLocaleString("ru-RU")}
              </div>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs text-muted-foreground">Место встречи</span>
              <div className="font-medium">
                {meetPlaceLabel ?? (
                  <span className="text-destructive">Не указано клиентом — принять нельзя</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Сумма</span>
              <div className="font-medium">
                {activeOrder.amountTotal ? `${Number(activeOrder.amountTotal)} ₽` : "—"}
              </div>
            </div>
          </div>
          {longEtaPending ? (
            <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 font-medium text-sky-900 dark:text-sky-200">
              Прибытие более {LONG_INSTRUCTOR_ETA_MINUTES} мин — заявка не закроется автоматически, пока вы не
              отклоните её или клиент не отменит.
            </div>
          ) : isUrgent ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-medium text-amber-800 dark:text-amber-200">
              Срочно — осталось {formatUrgentCountdown(pendingPromptSecondsLeft ?? 0)} из {urgentDeadlineLabel()}
            </div>
          ) : null}
          {activeOrder.requestedStartDate ? (
            <div>
              Даты: {new Date(activeOrder.requestedStartDate).toLocaleDateString("ru-RU")}
              {activeOrder.requestedEndDate
                ? ` - ${new Date(activeOrder.requestedEndDate).toLocaleDateString("ru-RU")}`
                : ""}
              {activeOrder.requestedDays ? ` (${activeOrder.requestedDays} дн.)` : ""}
            </div>
          ) : null}
          <OrderLessonTimeBlock order={activeOrder} timeClassName="font-medium" />
        </div>

        {!isAutoAccepted && !skipsEta ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor="instructor-eta-minutes">Через сколько минут будете на месте встречи</Label>
            <Input
              id="instructor-eta-minutes"
              type="number"
              min={1}
              max={240}
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(Math.min(240, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
        ) : null}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              stopInstructorOrderBeepRepeat();
              dismissPendingPrompt(activeOrder.id);
              dismissedRef.current = readDismissedPendingPromptIds();
              setPendingPromptOrderId(null);
            }}
            disabled={!isAutoAccepted && respond.isPending}
          >
            Позже
          </Button>
          {isAutoAccepted ? (
            <Button
              type="button"
              variant="accent"
              className="w-full sm:w-auto"
              onClick={() => {
                dismissPendingPrompt(activeOrder.id);
                dismissedRef.current = readDismissedPendingPromptIds();
                setPendingPromptOrderId(null);
                router.push(`/instructor/orders/${activeOrder.id}`);
              }}
            >
              Открыть заказ
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => respond.mutate({ orderId: activeOrder.id, action: "reject" })}
                disabled={respond.isPending}
              >
                Отклонить
              </Button>
              <Button
                type="button"
                variant="accent"
                className="w-full sm:w-auto"
                onClick={() =>
                  respond.mutate({
                    orderId: activeOrder.id,
                    action: "accept",
                    ...(skipsEta ? {} : { etaMinutes }),
                  })
                }
                disabled={
                  respond.isPending ||
                  !hasMeetPlace ||
                  (!relaxedTiming &&
                    !longEtaPending &&
                    !instructorCanAcceptAfterDeadline(activeOrder.pendingExpiresAt))
                }
              >
                Подтвердить и открыть заказ
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
