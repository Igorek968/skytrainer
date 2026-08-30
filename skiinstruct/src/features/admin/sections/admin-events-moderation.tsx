"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminEventEditorSheet } from "@/features/admin/admin-event-editor-sheet";
import type { InstructorEventDTO } from "@/lib/instructor-events";
import {
  formatEventDateRu,
  instructorEventHasSchedule,
  moderationStatusLabel,
} from "@/lib/instructor-events";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";

type PendingEvent = InstructorEventDTO & {
  instructor: { id: string; name: string | null; email: string };
  catalogItem?: {
    id: string;
    title: string;
    status: string;
    citySlug?: string | null;
    photoUrl?: string | null;
  } | null;
};

function EventModerationPhotos({ ev }: { ev: PendingEvent }) {
  const eventSrc = publicUploadDisplaySrc(ev.photoUrl);
  const catalogSrc = publicUploadDisplaySrc(ev.catalogItem?.photoUrl);
  const showCatalog = Boolean(catalogSrc && catalogSrc !== eventSrc);
  if (!eventSrc && !showCatalog) {
    return <p className="mt-2 text-xs text-muted-foreground">Фото не приложено</p>;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {eventSrc ? (
        <a href={eventSrc} target="_blank" rel="noreferrer" className="block w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={eventSrc}
            alt={`Фото события «${ev.title}»`}
            className="aspect-[16/9] w-full rounded-md border border-border object-cover"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">Фото события — нажмите, чтобы открыть</span>
        </a>
      ) : null}
      {showCatalog && catalogSrc ? (
        <a href={catalogSrc} target="_blank" rel="noreferrer" className="block w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catalogSrc}
            alt={`Обложка каталога «${ev.catalogItem?.title ?? ""}»`}
            className="aspect-[16/9] w-full rounded-md border border-border object-cover"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Обложка каталога{ev.catalogItem?.title ? `: ${ev.catalogItem.title}` : ""}
          </span>
        </a>
      ) : null}
    </div>
  );
}

function parseApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const err = (payload as { error?: unknown }).error;
  if (typeof err === "string" && err.trim().length > 0) return err;
  if (err && typeof err === "object" && "formErrors" in err) {
    const fe = (err as { formErrors?: string[] }).formErrors;
    if (fe?.[0]) return fe[0];
  }
  return fallback;
}

export function AdminEventsModerationSection() {
  const qc = useQueryClient();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [editEventId, setEditEventId] = useState<string | null>(null);

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
      const raw = await r.text();
      let payload: unknown = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }
      if (!r.ok) {
        throw new Error(parseApiError(payload, `Ошибка модерации (${r.status})`));
      }
      const ok = payload as { message?: string; event?: { title?: string } };
      if (!ok.event?.title) {
        throw new Error("Сервер не подтвердил публикацию. Обновите страницу и проверьте статус.");
      }
      return ok;
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? `Опубликовано: ${result.event?.title ?? "событие"}`);
      setRejectId(null);
      setRejectNote("");
      await qc.invalidateQueries({ queryKey: ["admin-pending-events"] });
      await qc.invalidateQueries({ queryKey: ["client-events"] });
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const events = data?.events ?? [];
  const autoApproveEnabled = data?.autoApproveEnabled === true;

  return (
    <Card>
      {editEventId ? (
        <AdminEventEditorSheet eventId={editEventId} onClose={() => setEditEventId(null)} />
      ) : null}
      <CardHeader>
        <CardTitle>События инструкторов</CardTitle>
        <CardDescription>
          После одобрения публикация появляется в ленте клиентов. Заявки «присоединиться к каталогу»
          помечены бейджем — у инструктора своя цена и описание сервиса. Выполненные по дате
          редактировать нельзя.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {autoApproveEnabled ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Включён режим <strong>SKIINSTRUCT_AUTO_APPROVE_EVENTS=1</strong>: после кнопки «На модерацию» у
            инструктора событие сразу становится «Опубликовано», очередь здесь не заполняется. Чтобы видеть
            заявки в модерации, задайте <code className="text-xs">SKIINSTRUCT_AUTO_APPROVE_EVENTS=0</code> в{" "}
            <code className="text-xs">.env</code> и перезапустите контейнер{" "}
            <code className="text-xs">skiinstruct</code>, затем отправьте событие на модерацию снова.
          </p>
        ) : null}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : !events.length ? (
          <p className="text-sm text-muted-foreground">
            {autoApproveEnabled
              ? "Очередь пуста из‑за автоодобрения (см. выше)."
              : "Нет событий на модерации."}
          </p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li key={ev.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{ev.title}</div>
                  {ev.catalogItemId && ev.catalogItem ? (
                    <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
                      Каталог: {ev.catalogItem.title}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {ev.instructor.name ?? ev.instructor.email} · {moderationStatusLabel(ev.moderationStatus)}
                  {ev.eventAt ? ` · ${formatEventDateRu(ev.eventAt)}` : " · дата и время не указаны"}
                  {ev.priceRub != null ? ` · ${ev.priceRub} ₽` : null}
                  {ev.maxRegistrations != null ? ` · мест: ${ev.maxRegistrations}` : null}
                </div>
                {!instructorEventHasSchedule({
                  eventAt: ev.eventAt,
                  slotsCount: ev.hasSlots ? 1 : 0,
                }) ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    Нельзя опубликовать: укажите дату и время через «Редактировать» или отклоните заявку.
                  </p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {ev.catalogItemId ? (
                    <>
                      <span className="font-medium text-foreground">Сервис инструктора: </span>
                      {ev.body}
                    </>
                  ) : (
                    ev.body
                  )}
                </p>
                <EventModerationPhotos ev={ev} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="accent"
                    disabled={
                      review.isPending ||
                      !instructorEventHasSchedule({
                        eventAt: ev.eventAt,
                        slotsCount: ev.hasSlots ? 1 : 0,
                      })
                    }
                    onClick={() => review.mutate({ eventId: ev.id, action: "approve" })}
                  >
                    {ev.catalogItemId ? "Одобрить участие" : "Опубликовать"}
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
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditEventId(ev.id)}
                  >
                    Редактировать
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
