"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

type ReferralPayoutRequestRow = {
  id: string;
  amountRub: number;
  status: string;
  adminNote: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null; role: string };
};

export function AdminReferralPayoutRequestsSection() {
  const [requests, setRequests] = useState<ReferralPayoutRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/referral-payout-requests", { credentials: "include" });
      const j = (await res.json()) as { requests?: ReferralPayoutRequestRow[] };
      if (res.ok) {
        setRequests(j.requests ?? []);
        setNotes((prev) => {
          const next = { ...prev };
          for (const r of j.requests ?? []) {
            if (next[r.id] === undefined) next[r.id] = r.adminNote ?? "";
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(id: string, status: "PROCESSING" | "COMPLETED" | "REJECTED") {
    const adminNote = notes[id]?.trim() || undefined;
    if (status === "REJECTED" && !adminNote) {
      toast.error("Укажите причину отклонения");
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/referral-payout-requests/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Ошибка");
        return;
      }
      toast.success("Обновлено");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Вывод реферального баланса</CardTitle>
        <CardDescription>Заявки от клиентов и инструкторов по реферальной программе.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? <p className="text-muted-foreground">Загрузка…</p> : null}
        {!loading && !requests.length ? (
          <p className="text-muted-foreground">Заявок нет.</p>
        ) : null}
        {requests.map((r) => (
          <div key={r.id} className="rounded-md border border-border p-3">
            <div className="font-medium">
              {r.user.name ?? "—"} · {r.amountRub.toFixed(0)} ₽ · {r.status}
            </div>
            <div className="text-xs text-muted-foreground">
              {r.user.email} · {r.user.role} · {formatInAppTimeZone(r.createdAt)}
            </div>
            {r.adminNote && r.status !== "PENDING" && r.status !== "PROCESSING" ? (
              <p className="mt-1 text-xs text-muted-foreground">Заметка: {r.adminNote}</p>
            ) : null}
            {r.status === "PENDING" || r.status === "PROCESSING" ? (
              <div className="mt-2 space-y-2">
                <Input
                  placeholder="Заметка / причина отклонения"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
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
                    variant="destructive"
                    disabled={busyId === r.id}
                    onClick={() => void patchStatus(r.id, "REJECTED")}
                  >
                    Отклонить
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
