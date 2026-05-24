"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import type { InstructorEventDTO } from "@/lib/instructor-events";
import { formatEventDateRu, moderationStatusLabel } from "@/lib/instructor-events";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";

type PendingEvent = InstructorEventDTO & {
  instructor: { id: string; name: string | null; email: string };
};

export function AdminEventsModerationSection() {
  const qc = useQueryClient();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-pending-events"],
    queryFn: async () => {
      const r = await fetch("/api/admin/events", { credentials: "include" });
      if (!r.ok) throw new Error("events");
      return r.json() as Promise<{ events: PendingEvent[]; autoApproveEnabled?: boolean }>;
    },
    refetchInterval: 20_000,
  });

  const review = useMutation({
    mutationFn: async (params: { eventId: string; action: "approve" | "reject"; rejectNote?: string }) => {
      const r = await fetch(`/api/admin/events/${params.eventId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: params.action, rejectNote: params.rejectNote }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "review");
      }
      return r.json();
    },
    onSuccess: async () => {
      toast.success("Готово");
      setRejectId(null);
      setRejectNote("");
      await qc.invalidateQueries({ queryKey: ["admin-pending-events"] });
    },
    onError: (e: Error) => toast.error(e.message === "review" ? "Ошибка модерации" : e.message),
  });

  const events = data?.events ?? [];
  const autoApproveEnabled = data?.autoApproveEnabled === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Мероприятия инструкторов</CardTitle>
        <CardDescription>
          После одобрения публикация появляется в ленте клиентов. Выполненные по дате редактировать нельзя.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {autoApproveEnabled ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Включён режим <strong>SKIINSTRUCT_AUTO_APPROVE_EVENTS=1</strong>: после кнопки «На модерацию» у
            инструктора мероприятие сразу становится «Опубликовано», очередь здесь не заполняется. Чтобы видеть
            заявки в модерации, задайте <code className="text-xs">SKIINSTRUCT_AUTO_APPROVE_EVENTS=0</code> в{" "}
            <code className="text-xs">.env</code> и перезапустите контейнер{" "}
            <code className="text-xs">skiinstruct</code>, затем отправьте мероприятие на модерацию снова.
          </p>
        ) : null}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : !events.length ? (
          <p className="text-sm text-muted-foreground">
            {autoApproveEnabled
              ? "Очередь пуста из‑за автоодобрения (см. выше)."
              : "Нет мероприятий на модерации."}
          </p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li key={ev.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="font-medium">{ev.title}</div>
                <div className="text-xs text-muted-foreground">
                  {ev.instructor.name ?? ev.instructor.email} · {moderationStatusLabel(ev.moderationStatus)}
                  {ev.eventAt ? ` · ${formatEventDateRu(ev.eventAt)}` : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{ev.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="accent"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ eventId: ev.id, action: "approve" })}
                  >
                    Опубликовать
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={review.isPending}
                    onClick={() => setRejectId(ev.id)}
                  >
                    Отклонить…
                  </Button>
                </div>
                {rejectId === ev.id ? (
                  <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-2">
                    <Label htmlFor={`reject-${ev.id}`}>Комментарий инструктору</Label>
                    <textarea
                      id={`reject-${ev.id}`}
                      className="min-h-[60px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={review.isPending}
                        onClick={() =>
                          review.mutate({
                            eventId: ev.id,
                            action: "reject",
                            rejectNote: rejectNote.trim() || undefined,
                          })
                        }
                      >
                        Отклонить
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setRejectId(null)}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
