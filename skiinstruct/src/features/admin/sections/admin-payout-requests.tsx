"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

type AdminPayoutRequest = {
  id: string;
  amountRub: number;
  status: string;
  adminNote: string | null;
  createdAt: string;
  orderCount: number;
  instructor: { id: string; name: string | null; email: string };
};

export function AdminPayoutRequestsSection() {
  const [requests, setRequests] = useState<AdminPayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payout-requests", { credentials: "include" });
      const j = (await res.json()) as { requests?: AdminPayoutRequest[] };
      if (res.ok) setRequests(j.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(id: string, status: "PROCESSING" | "COMPLETED" | "REJECTED") {
    setBusyId(id);
    try {
      await fetch(`/api/admin/payout-requests/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Заявки на выплату инструкторам</CardTitle>
        <CardDescription>Ручной перевод по реквизитам из кабинета инструктора.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? <p className="text-muted-foreground">Загрузка…</p> : null}
        {!loading && !requests.length ? (
          <p className="text-muted-foreground">Активных заявок нет.</p>
        ) : null}
        {requests.map((r) => (
          <div key={r.id} className="rounded-md border border-border p-3">
            <div className="font-medium">
              {r.instructor.name ?? "—"} · {r.amountRub.toFixed(0)} ₽ · {r.status}
            </div>
            <div className="text-xs text-muted-foreground">
              {r.instructor.email} · заказов: {r.orderCount} · {new Date(r.createdAt).toLocaleString("ru-RU")}
            </div>
            {r.status === "PENDING" || r.status === "PROCESSING" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.status === "PENDING" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.id}
                    onClick={() => void patchStatus(r.id, "PROCESSING")}
                  >
                    В работе
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="accent"
                  disabled={busyId === r.id}
                  onClick={() => void patchStatus(r.id, "COMPLETED")}
                >
                  Выплачено
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === r.id}
                  onClick={() => void patchStatus(r.id, "REJECTED")}
                >
                  Отклонить
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
