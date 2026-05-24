"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";

type RefundPreview = {
  refundPercent: number;
  refundAmount: number;
  reason: string;
};

export function CancelOrderButton({
  orderId,
  disabled,
  onCancelled,
}: {
  orderId: string;
  disabled?: boolean;
  onCancelled: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    setLoading(true);
    try {
      const previewRes = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview_cancel_refund" }),
      });
      const preview = (await previewRes.json()) as RefundPreview & { error?: string };
      if (!previewRes.ok) {
        toast.error(preview.error ?? "Не удалось рассчитать возврат");
        return;
      }
      const msg =
        preview.refundAmount > 0
          ? `Отменить заказ?\n\n${preview.reason}\nК возврату: ${preview.refundAmount} ₽ (${preview.refundPercent}%).`
          : `Отменить заказ?\n\n${preview.reason}`;
      if (!confirm(msg)) return;

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Не удалось отменить");
        return;
      }
      if (body.refundAmount > 0) {
        toast.success(`Заказ отменён. Возврат ${body.refundAmount} ₽ (${body.refundPercent}%) инициирован.`);
      } else {
        toast.success("Заказ отменён");
      }
      onCancelled();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="destructive" type="button" disabled={disabled || loading} onClick={handleCancel}>
      {loading ? "Отмена…" : "Отменить"}
    </Button>
  );
}

export function ClaimLateRefundButton({
  orderId,
  disabled,
  onDone,
}: {
  orderId: string;
  disabled?: boolean;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClaim() {
    if (
      !confirm(
        "Запросить полный возврат из‑за опоздания инструктора (более 15 минут после ETA)? Заказ будет отменён.",
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_late_refund" }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Не удалось оформить возврат");
        return;
      }
      toast.success(`Полный возврат ${body.refundAmount} ₽ инициирован`);
      onDone();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" type="button" disabled={disabled || loading} onClick={handleClaim}>
      {loading ? "Обработка…" : "Полный возврат (опоздание)"}
    </Button>
  );
}
