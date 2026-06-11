"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  QUALITY_CLAIM_CATEGORIES,
  qualityClaimCategoryLabels,
  type QualityClaimCategory,
} from "@/lib/refund-policy";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

type Props = {
  orderId: string;
  clientRating: number | null;
  disabled?: boolean;
  onDone: () => void;
};

export function QualityRefundClaim({ orderId, clientRating, disabled, onDone }: Props) {
  const [category, setCategory] = useState<QualityClaimCategory>("INCOMPETENCE");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function preview() {
    const r = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview_quality_refund",
        category,
        description,
      }),
    });
    const body = (await r.json()) as {
      error?: string;
      eligible?: boolean;
      refundPercent?: number;
      refundAmount?: number;
      reason?: string;
    };
    if (!r.ok) {
      toast.error(body.error ?? "Не удалось рассчитать возврат");
      return;
    }
    if (!body.eligible) {
      toast.error("Претензия по этому заказу сейчас недоступна");
      return;
    }
    if ((body.refundPercent ?? 0) <= 0) {
      toast.error(body.reason ?? "Возврат по выбранной причине не предусмотрен");
      return;
    }
    const ok = confirm(
      `${body.reason}\n\nК возврату: ${body.refundAmount} ₽ (${body.refundPercent}%).\n\nОтправить претензию?`,
    );
    if (!ok) return;

    setBusy(true);
    try {
      const submit = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim_quality_refund",
          category,
          description,
        }),
      });
      const result = (await submit.json()) as {
        error?: string;
        refundAmount?: number;
        refundPercent?: number;
      };
      if (!submit.ok) {
        toast.error(result.error ?? "Не удалось оформить претензию");
        return;
      }
      toast.success(
        `Возврат ${result.refundAmount} ₽ (${result.refundPercent}%) инициирован`,
      );
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-sm font-medium">Претензия по качеству урока</p>
      {clientRating == null ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Сначала оставьте оценку инструктору — для части категорий она учитывается в расчёте.
        </p>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor={`quality-cat-${orderId}`}>Причина</Label>
        <select
          id={`quality-cat-${orderId}`}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value as QualityClaimCategory)}
          disabled={busy || disabled}
        >
          {QUALITY_CLAIM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {qualityClaimCategoryLabels[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`quality-desc-${orderId}`}>Описание ситуации</Label>
        <textarea
          id={`quality-desc-${orderId}`}
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy || disabled}
          placeholder="Кратко опишите, что пошло не так"
        />
      </div>
      <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={() => void preview()}>
        Рассчитать и подать претензию
      </Button>
    </div>
  );
}
