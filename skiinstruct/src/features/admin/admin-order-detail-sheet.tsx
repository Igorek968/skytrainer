"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { orderStatusLabel } from "@/shared/lib/order-status";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type Props = {
  orderId: string;
  onClose: () => void;
};

export function AdminOrderDetailSheet({ orderId, onClose }: Props) {
  const qc = useQueryClient();
  const [instructorId, setInstructorId] = useState("");

  const query = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/orders/${orderId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Не удалось загрузить заказ");
      return r.json() as Promise<{
        order: {
          id: string;
          status: string;
          paymentStatus: string;
          amountTotal: number | null;
          clientName: string | null;
          clientEmail: string | null;
          instructorName: string | null;
          clientId: string;
          instructorId: string | null;
          notes: string | null;
          refundPercent: number | null;
          refundAmount: number | null;
          refundStatus: string;
          refundNote: string | null;
          qualityClaimedAt: string | null;
          qualityClaimCategory: string | null;
          qualityClaimDescription: string | null;
          acceptedAt: string | null;
          lessonStartedAt: string | null;
          lessonEndedAt: string | null;
          createdAt: string;
          updatedAt: string;
          pendingExpiresAt: string | null;
          messages: {
            id: string;
            body: string;
            createdAt: string;
            sender: { name: string | null; email: string; role: string };
          }[];
        };
      }>;
    },
  });

  const action = useMutation({
    mutationFn: async (body: {
      action: "cancel_refund" | "retry_refund" | "reassign_instructor";
      instructorId?: string;
    }) => {
      const r = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { error?: string; message?: string };
      if (!r.ok) throw new Error(j.error ?? "Ошибка");
      return j;
    },
    onSuccess: async (j) => {
      toast.success(j.message ?? "Готово");
      await qc.invalidateQueries({ queryKey: ["admin-order", orderId] });
      await qc.invalidateQueries({ queryKey: ["admin-orders-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const o = query.data?.order;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Заказ</h2>
            <p className="font-mono text-xs text-muted-foreground">{orderId}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : query.error || !o ? (
          <p className="text-sm text-destructive">Не удалось загрузить заказ.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge>{orderStatusLabel(o.status as never)}</Badge>
              <Badge variant="outline">{o.paymentStatus}</Badge>
              {o.amountTotal != null ? (
                <Badge variant="secondary">{Math.round(o.amountTotal)} ₽</Badge>
              ) : null}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                Клиент: <span className="text-foreground">{o.clientName ?? "—"}</span> ·{" "}
                {o.clientEmail}
              </p>
              <p>
                Инструктор:{" "}
                <span className="text-foreground">{o.instructorName ?? "не назначен"}</span>
                {o.instructorId ? (
                  <span className="ml-1 font-mono">({o.instructorId.slice(0, 8)}…)</span>
                ) : null}
              </p>
              <p>Создан: {formatInAppTimeZone(o.createdAt)}</p>
              <p>Обновлён: {formatInAppTimeZone(o.updatedAt)}</p>
              {o.acceptedAt ? <p>Принят: {formatInAppTimeZone(o.acceptedAt)}</p> : null}
              {o.lessonStartedAt ? (
                <p>Урок начат: {formatInAppTimeZone(o.lessonStartedAt)}</p>
              ) : null}
              {o.lessonEndedAt ? <p>Урок окончен: {formatInAppTimeZone(o.lessonEndedAt)}</p> : null}
              {o.pendingExpiresAt ? (
                <p>Дедлайн ответа: {formatInAppTimeZone(o.pendingExpiresAt)}</p>
              ) : null}
            </div>
            {o.notes ? (
              <p className="rounded-md bg-muted/40 px-2 py-1.5 text-xs whitespace-pre-wrap">{o.notes}</p>
            ) : null}
            {(o.refundStatus && o.refundStatus !== "NOT_APPLICABLE") || o.refundNote ? (
              <div className="rounded-md border border-border p-2 text-xs">
                <p className="font-medium">Возврат: {o.refundStatus}</p>
                {o.refundAmount != null ? (
                  <p>
                    {o.refundAmount} ₽ ({o.refundPercent ?? "—"}%)
                  </p>
                ) : null}
                {o.refundNote ? <p className="mt-1 text-muted-foreground">{o.refundNote}</p> : null}
              </div>
            ) : null}
            {o.qualityClaimedAt ? (
              <div className="rounded-md border border-amber-300/60 bg-amber-50/50 p-2 text-xs dark:bg-amber-950/30">
                <p className="font-medium">Претензия · {o.qualityClaimCategory}</p>
                <p className="text-muted-foreground">{o.qualityClaimDescription}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Действия</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() => {
                    if (confirm("Отменить заказ с возвратом по правилам?")) {
                      action.mutate({ action: "cancel_refund" });
                    }
                  }}
                >
                  Отменить + возврат
                </Button>
                {o.refundStatus === "FAILED" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="accent"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ action: "retry_refund" })}
                  >
                    Повторить возврат
                  </Button>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="reassign-id">Переназначить инструктора (user id)</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="reassign-id"
                    className="h-8 font-mono text-xs"
                    placeholder="cuid инструктора"
                    value={instructorId}
                    onChange={(e) => setInstructorId(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={action.isPending || !instructorId.trim()}
                    onClick={() =>
                      action.mutate({
                        action: "reassign_instructor",
                        instructorId: instructorId.trim(),
                      })
                    }
                  >
                    Переназначить
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Чат заказа ({o.messages.length})
              </p>
              {o.messages.length ? (
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                  {o.messages.map((m) => (
                    <li key={m.id} className="text-xs">
                      <span className="text-muted-foreground">
                        {m.sender.name ?? m.sender.email} · {formatInAppTimeZone(m.createdAt)}
                      </span>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Сообщений нет.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
