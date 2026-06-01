"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { OrderStatus } from "@prisma/client";

import { playInstructorOrderBeep } from "@/features/instructor/instructor-order-beep";
import { devPollInterval } from "@/lib/query-poll";
import {
  dismissPendingPrompt,
  readDismissedPendingPromptIds,
} from "@/lib/instructor-pending-prompt-storage";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  orderRelaxedInstructorTiming,
  orderRelaxedTimingHint,
  orderSkipsInstructorEta,
} from "@/shared/lib/order-flex";
import { isLongInstructorEtaMinutes, LONG_INSTRUCTOR_ETA_MINUTES } from "@/shared/lib/order-long-eta";
import { OrderLessonTimeBlock } from "@/shared/ui/order-lesson-time-block";
import { orderHasMeetAddress, resolveMeetAddress } from "@/shared/lib/order-meet-address";
import { orderStatusLabel } from "@/shared/lib/order-status";

type PendingOrderRow = {
  id: string;
  status: string;
  createdAt: string;
  pendingExpiresAt: string | null;
  flexibleInstructorInvite?: boolean;
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
    requestedDays: o.requestedDays ?? null,
    requestedStartDate: o.requestedStartDate,
  };
}

/**
 * Всплывающее окно + звук при новой заявке PENDING_INSTRUCTOR (все страницы кабинета).
 */
export function InstructorPendingOrderPrompt() {
  const router = useRouter();
  const qc = useQueryClient();
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
    refetchInterval: devPollInterval(5000),
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

    const pending = orderAlerts.orders.filter((o) => {
      if (o.status !== "PENDING_INSTRUCTOR") return false;
      const relaxed = orderRelaxedInstructorTiming(orderTimingInput(o));
      if (relaxed) return true;
      if (!o.pendingExpiresAt) return true;
      const expMs = new Date(o.pendingExpiresAt).getTime();
      return Number.isFinite(expMs) && expMs > Date.now();
    });

    if (!initializedRef.current) {
      for (const p of pending) seenIdsRef.current.add(p.id);
      initializedRef.current = true;
      return;
    }

    const newlySeen = pending.find(
      (o) => !seenIdsRef.current.has(o.id) && !dismissed.has(o.id),
    );
    for (const p of pending) seenIdsRef.current.add(p.id);

    if (newlySeen) {
      playInstructorOrderBeep();
      setPendingPromptOrderId(newlySeen.id);
      setEtaMinutes(20);
    }
  }, [orderAlerts?.orders, suppress]);

  const activeOrder =
    orderAlerts?.orders.find(
      (o) => o.id === pendingPromptOrderId && o.status === "PENDING_INSTRUCTOR",
    ) ?? null;

  const relaxedTiming = activeOrder
    ? orderRelaxedInstructorTiming(orderTimingInput(activeOrder))
    : false;
  const skipsEta = activeOrder ? orderSkipsInstructorEta(orderTimingInput(activeOrder)) : false;

  const longEtaPending = !skipsEta && isLongInstructorEtaMinutes(etaMinutes);
  const hasMeetPlace = activeOrder ? orderHasMeetAddress(activeOrder) : false;
  const meetPlaceLabel = activeOrder ? resolveMeetAddress(activeOrder) : null;

  const relaxedHint = activeOrder ? orderRelaxedTimingHint(orderTimingInput(activeOrder)) : "";

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
  }, [activeOrder, relaxedTiming, longEtaPending]);

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
    if (pendingPromptSecondsLeft == null || pendingPromptSecondsLeft > 0) return;
    setPendingPromptOrderId(null);
    setPendingPromptSecondsLeft(null);
    toast.info("Время ответа истекло. Заявка закрыта для клиента.");
    void qc.invalidateQueries({ queryKey: ["instructor-order-alerts"] });
    void qc.invalidateQueries({ queryKey: ["orders"] });
  }, [activeOrder, pendingPromptSecondsLeft, relaxedTiming, longEtaPending, qc]);

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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructor-new-order-title"
    >
      <div className="max-h-[min(92dvh,640px)] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-xl">
        <h2 id="instructor-new-order-title" className="text-lg font-semibold">
          Новая заявка от клиента
        </h2>
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
          ) : !relaxedTiming ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-medium text-amber-800 dark:text-amber-200">
              На ознакомление и решение: {pendingPromptSecondsLeft ?? 0} сек
            </div>
          ) : relaxedHint ? (
            <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 font-medium text-sky-900 dark:text-sky-200">
              {relaxedHint}
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

        {!skipsEta ? (
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
              dismissPendingPrompt(activeOrder.id);
              dismissedRef.current = readDismissedPendingPromptIds();
              setPendingPromptOrderId(null);
            }}
            disabled={respond.isPending}
          >
            Позже
          </Button>
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
                pendingPromptSecondsLeft !== null &&
                pendingPromptSecondsLeft <= 0)
            }
          >
            Подтвердить и открыть заказ
          </Button>
        </div>
      </div>
    </div>
  );
}
