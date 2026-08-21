"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EVENT_FORCE_MAJEURE_REASON_MAX } from "@/lib/legal-config";
import { Button } from "@/shared/ui/button";

export function ForceMajeureCancelButton({
  eventId,
  enabled,
}: {
  eventId: string;
  enabled: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const mutate = useMutation({
    mutationFn: async () => {
      const trimmed = reason.trim();
      if (trimmed.length < 3) {
        throw new Error(`Укажите причину (от 3 до ${EVENT_FORCE_MAJEURE_REASON_MAX} символов)`);
      }
      const r = await fetch(`/api/instructor/events/${eventId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "force_majeure", reason: trimmed }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось оформить форс-мажор");
      return j;
    },
    onSuccess: async (j) => {
      toast.success(j.message ?? "Форс-мажор оформлен — клиентам полный возврат");
      setOpen(false);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["instructor-event-registrations", eventId] });
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
      await qc.invalidateQueries({ queryKey: ["instructor-registrations"] });
      await qc.invalidateQueries({ queryKey: ["instructor-registration"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!enabled) return null;

  return (
    <div className="space-y-2">
      {!open ? (
        <Button
          type="button"
          variant="outline"
          className="border-amber-600/50 text-amber-900 dark:text-amber-100"
          disabled={mutate.isPending}
          onClick={() => setOpen(true)}
        >
          Форс-мажор отмена
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm text-amber-950 dark:text-amber-100">
            Событие не состоялось (погода и др.). Укажите причину — всем оплатившим вернётся 100%, штраф
            инструктору не начисляется. Причина уйдёт в админку.
          </p>
          <label className="block text-xs text-muted-foreground">
            Комментарий ({reason.trim().length}/{EVENT_FORCE_MAJEURE_REASON_MAX})
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              rows={3}
              maxLength={EVENT_FORCE_MAJEURE_REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, EVENT_FORCE_MAJEURE_REASON_MAX))}
              placeholder="Например: сильный дождь, занятие отменено"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="accent"
              disabled={mutate.isPending || reason.trim().length < 3}
              onClick={() => mutate.mutate()}
            >
              {mutate.isPending ? "…" : "Подтвердить отмену и возврат"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={mutate.isPending}
              onClick={() => {
                setOpen(false);
                setReason("");
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
