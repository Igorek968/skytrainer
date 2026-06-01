"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { playInstructorOrderBeep } from "@/features/instructor/instructor-order-beep";
import { devPollInterval } from "@/lib/query-poll";
import { isInLessonStartPopupWindow } from "@/shared/lib/order-lesson-start";
import { OrderLessonTimeBlock } from "@/shared/ui/order-lesson-time-block";
import { orderRelaxedInstructorTiming } from "@/shared/lib/order-flex";
import { resolveMeetAddress } from "@/shared/lib/order-meet-address";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type SoonOrderRow = {
  id: string;
  status: string;
  requestedStartDate: string | null;
  notes: string | null;
  meetAddress?: string | null;
  flexibleInstructorInvite?: boolean;
  requestedDays: number | null;
  client: { name: string | null } | null;
};

function extractEtaFromNotes(notes: string | null | undefined): number {
  const match = (notes ?? "").match(/ETA инструктора:\s*~?(\d{1,3})\s*мин/i);
  const val = match ? Number(match[1]) : 20;
  if (!Number.isFinite(val) || val < 1) return 20;
  return Math.min(240, Math.max(1, Math.round(val)));
}

/**
 * За ~5 мин до начала встречи — всплывающее окно со звуком и сменой ETA.
 */
export function InstructorLessonSoonPrompt() {
  const router = useRouter();
  const qc = useQueryClient();
  const [promptOrderId, setPromptOrderId] = useState<string | null>(null);
  const [etaMinutes, setEtaMinutes] = useState(20);
  const beepedIdsRef = useRef<Set<string>>(new Set());
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  const { data: orderAlerts } = useQuery({
    queryKey: ["instructor-order-alerts"],
    queryFn: async () => {
      const r = await fetch("/api/orders", { credentials: "include" });
      if (!r.ok) throw new Error("orders-alerts");
      return r.json() as Promise<{ orders: SoonOrderRow[] }>;
    },
    refetchInterval: devPollInterval(5000),
  });

  const soonOrders =
    orderAlerts?.orders.filter((o) => {
      if (o.status !== "ACCEPTED" && o.status !== "INSTRUCTOR_EN_ROUTE") return false;
      if (dismissedIdsRef.current.has(o.id)) return false;
      if (
        orderRelaxedInstructorTiming({
          flexibleInstructorInvite: Boolean(o.flexibleInstructorInvite),
          requestedDays: o.requestedDays,
          requestedStartDate: o.requestedStartDate,
        })
      ) {
        return false;
      }
      return isInLessonStartPopupWindow(o.requestedStartDate);
    }) ?? [];

  useEffect(() => {
    if (!soonOrders.length) return;
    const target = soonOrders[0]!;
    if (!beepedIdsRef.current.has(target.id)) {
      beepedIdsRef.current.add(target.id);
      playInstructorOrderBeep();
    }
    setPromptOrderId((prev) => prev ?? target.id);
    setEtaMinutes(extractEtaFromNotes(target.notes));
  }, [soonOrders]);

  const activeOrder = orderAlerts?.orders.find((o) => o.id === promptOrderId) ?? null;

  const updateEta = useMutation({
    mutationFn: async (payload: { orderId: string; etaMinutes: number }) => {
      const r = await fetch(`/api/orders/${payload.orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "set_eta", etaMinutes: payload.etaMinutes }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось обновить время");
    },
    onSuccess: async (_, { etaMinutes: m }) => {
      await qc.invalidateQueries({ queryKey: ["instructor-order-alerts"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Время прибытия обновлено: ~${m} мин`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!activeOrder || !isInLessonStartPopupWindow(activeOrder.requestedStartDate)) return null;

  const meetPlace = resolveMeetAddress(activeOrder);
  const startLabel = activeOrder.requestedStartDate
    ? new Date(activeOrder.requestedStartDate).toLocaleString("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  return (
    <div
      className="fixed inset-0 z-[99] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructor-lesson-soon-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-4 shadow-xl">
        <h2 id="instructor-lesson-soon-title" className="text-lg font-semibold">
          Скоро встреча с клиентом
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Клиент: {activeOrder.client?.name || "Без имени"} · начало {startLabel}
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">Место встречи</span>
            <div className="font-medium">{meetPlace ?? "—"}</div>
          </div>
          <OrderLessonTimeBlock order={activeOrder} timeClassName="font-medium" />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="lesson-soon-eta">Через сколько минут будете у клиента</Label>
          <Input
            id="lesson-soon-eta"
            type="number"
            min={1}
            max={240}
            value={etaMinutes}
            onChange={(e) => setEtaMinutes(Math.min(240, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              dismissedIdsRef.current.add(activeOrder.id);
              setPromptOrderId(null);
            }}
          >
            Закрыть
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={updateEta.isPending}
            onClick={() => updateEta.mutate({ orderId: activeOrder.id, etaMinutes })}
          >
            Обновить время прибытия
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={() => router.push(`/instructor/orders/${activeOrder.id}`)}
          >
            Открыть заказ
          </Button>
        </div>
      </div>
    </div>
  );
}
