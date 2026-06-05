"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";

type PayoutRequestRow = {
  id: string;
  amountRub: number;
  status: string;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
};

export function InstructorPayoutPanel({
  canWithdraw,
  payoutMinRub,
  availableForPayout,
}: {
  canWithdraw?: boolean;
  payoutMinRub?: number;
  availableForPayout?: number;
}) {
  const [requests, setRequests] = useState<PayoutRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(availableForPayout ?? 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/instructor/payout-request", { credentials: "include" });
      const j = (await res.json()) as {
        availableRub?: number;
        requests?: PayoutRequestRow[];
      };
      if (res.ok) {
        setAvailable(j.availableRub ?? 0);
        setRequests(j.requests ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestPayout() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/instructor/payout-request", {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Не удалось создать заявку");
        return;
      }
      await load();
    } catch {
      setError("Ошибка сети");
    } finally {
      setPending(false);
    }
  }

  const canRequest = canWithdraw ?? available >= (payoutMinRub ?? 500);

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <Button
        type="button"
        variant="accent"
        className="w-full sm:w-auto"
        disabled={!canRequest || pending || loading}
        onClick={() => void requestPayout()}
      >
        {pending ? "Отправка…" : "Запросить выплату"}
      </Button>
      {payoutMinRub ? (
        <p className="text-xs text-muted-foreground">Минимум к выводу: {payoutMinRub} ₽</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {requests.length ? (
        <div className="space-y-2 text-xs">
          <p className="font-medium text-foreground">Заявки на выплату</p>
          {requests.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
              <div>
                {r.amountRub.toFixed(0)} ₽ — {r.status}
              </div>
              {r.adminNote ? <div className="text-muted-foreground">{r.adminNote}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
