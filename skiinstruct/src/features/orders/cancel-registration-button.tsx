"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";

type RefundPreview = {
  refundPercent: number;
  refundAmount: number;
  reason: string;
};

export function CancelRegistrationButton({
  registrationId,
  disabled,
  onCancelled,
  size = "default",
  className,
}: {
  registrationId: string;
  disabled?: boolean;
  onCancelled: () => void;
  size?: "default" | "sm";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    setLoading(true);
    try {
      const previewRes = await fetch(`/api/client/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "preview_cancel" }),
      });
      const preview = (await previewRes.json()) as RefundPreview & { error?: string };
      if (!previewRes.ok) {
        toast.error(preview.error ?? "Не удалось рассчитать возврат");
        return;
      }
      const msg =
        preview.refundAmount > 0
          ? `Отменить заявку?\n\n${preview.reason}\nК возврату: ${preview.refundAmount} ₽ (${preview.refundPercent}%).`
          : `Отменить заявку?\n\n${preview.reason}`;
      if (!confirm(msg)) return;

      const res = await fetch(`/api/client/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "cancel" }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Не удалось отменить");
        return;
      }
      if (body.refundAmount > 0) {
        toast.success(
          `Заявка отменена. Возврат ${body.refundAmount} ₽ (${body.refundPercent}%) инициирован.`,
        );
      } else {
        toast.success("Заявка отменена");
      }
      onCancelled();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="destructive"
      type="button"
      size={size}
      className={className}
      disabled={disabled || loading}
      onClick={handleCancel}
    >
      {loading ? "Отмена…" : "Отменить запись"}
    </Button>
  );
}
