"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { InstructorEventDTO } from "@/lib/instructor-events";
import {
  canRestoreArchivedEvent,
  eventCardDeleteLabel,
  formatEventDateRu,
  formatEventPriceRu,
  moderationStatusLabel,
  showEventCardDelete,
  showEventCardEdit,
  showEventCardModeration,
  toDatetimeLocalValue,
} from "@/lib/instructor-events";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { EventRegistrantsPanel } from "@/features/instructor/event-registrants-panel";
import { cn } from "@/lib/utils";

type ActiveOrderOption = { id: string; label: string };
type TitleOption = { id: string; title: string };

async function instructorFetch(input: RequestInfo, init?: RequestInit) {
  return fetch(input, { ...init, credentials: "include" });
}

function CompletionBadge({ event }: { event: Pick<InstructorEventDTO, "isCompleted" | "eventAt"> }) {
  if (!event.eventAt) {
    return (
      <Badge variant="outline" className="text-xs">
        Дата не указана
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        event.isCompleted
          ? "border-muted-foreground/40 text-muted-foreground"
          : "border-emerald-500/50 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {event.isCompleted ? "Выполнено" : "Не выполнено"}
    </Badge>
  );
}

export function InstructorEventsEditor({
  activeOrders = [],
}: {
  activeOrders?: ActiveOrderOption[];
}) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [orderId, setOrderId] = useState("");
  const [priceRub, setPriceRub] = useState("");
  const [maxRegistrations, setMaxRegistrations] = useState("");
  const [canEdit, setCanEdit] = useState(true);
  const [loadedStatus, setLoadedStatus] = useState<InstructorEventDTO["moderationStatus"] | null>(null);
  const titleLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["instructor-events"],
    queryFn: async () => {
      const r = await instructorFetch("/api/instructor/events");
      if (!r.ok) throw new Error("events");
      return r.json() as Promise<{ events: InstructorEventDTO[]; titles: TitleOption[] }>;
    },
  });

  const loadFormFromEvent = useCallback((ev: InstructorEventDTO) => {
    setEditingId(ev.id);
    setTitle(ev.title);
    setBody(ev.body);
    setEventAt(toDatetimeLocalValue(ev.eventAt));
    setOrderId(ev.orderId ?? "");
    setPriceRub(ev.priceRub != null && ev.priceRub > 0 ? String(ev.priceRub) : "");
    setMaxRegistrations(
      ev.maxRegistrations != null ? String(ev.maxRegistrations) : "",
    );
    setCanEdit(ev.canEdit);
    setLoadedStatus(ev.moderationStatus);
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setEventAt("");
    setOrderId("");
    setPriceRub("");
    setMaxRegistrations("");
    setCanEdit(true);
    setLoadedStatus(null);
  }, []);

  const loadByTitle = useCallback(
    async (titleValue: string) => {
      const t = titleValue.trim();
      if (!t) return;
      const r = await instructorFetch(`/api/instructor/events/by-title?title=${encodeURIComponent(t)}`);
      if (!r.ok) return;
      const j = (await r.json()) as { event: InstructorEventDTO | null };
      if (j.event) {
        loadFormFromEvent(j.event);
        toast.message("Подгружено мероприятие с этим названием");
      } else {
        setEditingId(null);
        setBody("");
        setEventAt("");
        setOrderId("");
        setPriceRub("");
        setMaxRegistrations("");
        setCanEdit(true);
        setLoadedStatus(null);
      }
    },
    [loadFormFromEvent],
  );

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (titleLoadTimer.current) clearTimeout(titleLoadTimer.current);
    const trimmed = value.trim();
    if (!trimmed) return;
    const known = data?.titles.some((t) => t.title.toLowerCase() === trimmed.toLowerCase());
    if (known) {
      titleLoadTimer.current = setTimeout(() => void loadByTitle(trimmed), 400);
    }
  };

  useEffect(
    () => () => {
      if (titleLoadTimer.current) clearTimeout(titleLoadTimer.current);
    },
    [],
  );

  const saveDraft = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        body: body.trim(),
        orderId: orderId.trim() || null,
        eventId: editingId,
      };
      if (eventAt.trim()) payload.eventAt = new Date(eventAt).toISOString();
      const priceParsed = priceRub.trim() ? Number.parseInt(priceRub.trim(), 10) : NaN;
      payload.priceRub =
        Number.isFinite(priceParsed) && priceParsed >= 0 ? priceParsed : null;
      const maxParsed = maxRegistrations.trim()
        ? Number.parseInt(maxRegistrations.trim(), 10)
        : NaN;
      payload.maxRegistrations =
        Number.isFinite(maxParsed) && maxParsed >= 1 ? maxParsed : null;
      const r = await instructorFetch("/api/instructor/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "save");
      }
      return r.json() as Promise<{ event: InstructorEventDTO }>;
    },
    onSuccess: async (j) => {
      loadFormFromEvent(j.event);
      toast.success("Черновик сохранён");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) => toast.error(e.message === "save" ? "Не удалось сохранить" : e.message),
  });

  const submitModeration = useMutation({
    mutationFn: async (id: string) => {
      const r = await instructorFetch(`/api/instructor/events/${id}/submit`, { method: "POST" });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "submit");
      }
      return r.json() as Promise<{ event: InstructorEventDTO; message?: string }>;
    },
    onSuccess: async (j) => {
      loadFormFromEvent(j.event);
      toast.success(j.message ?? "Отправлено на модерацию");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) => toast.error(e.message === "submit" ? "Не удалось отправить" : e.message),
  });

  const restoreDraft = useMutation({
    mutationFn: async (id: string) => {
      const r = await instructorFetch(`/api/instructor/events/${id}/restore`, { method: "POST" });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "restore");
      }
      return r.json() as Promise<{ event: InstructorEventDTO; message?: string }>;
    },
    onSuccess: async (j) => {
      loadFormFromEvent(j.event);
      toast.success(j.message ?? "Восстановлено в черновик");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) =>
      toast.error(e.message === "restore" ? "Не удалось восстановить" : e.message),
  });

  const cancelEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const r = await instructorFetch(`/api/instructor/events/${eventId}/cancel`, {
        method: "POST",
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "cancel-event");
      return j;
    },
    onSuccess: async (j) => {
      toast.success(j.message ?? "Мероприятие отменено");
      if (editingId) resetForm();
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
      await qc.invalidateQueries({ queryKey: ["instructor-registrations"] });
    },
    onError: (e: Error) => toast.error(e.message === "cancel-event" ? "Не удалось отменить" : e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await instructorFetch(`/api/instructor/events/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "delete");
      }
      return r.json() as Promise<{ archived?: boolean }>;
    },
    onSuccess: async (data, id) => {
      toast.success(data.archived ? "Скрыто из ленты клиентов" : "Удалено");
      if (editingId === id) resetForm();
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) => toast.error(e.message === "delete" ? "Не удалось выполнить действие" : e.message),
  });

  const handleCardEdit = useCallback(
    (ev: InstructorEventDTO) => {
      if (canRestoreArchivedEvent(ev)) {
        restoreDraft.mutate(ev.id);
        return;
      }
      loadFormFromEvent(ev);
    },
    [loadFormFromEvent, restoreDraft],
  );

  const handleCardDelete = useCallback(
    (ev: InstructorEventDTO) => {
      if (ev.moderationStatus === "PUBLISHED") {
        if (confirm("Скрыть из ленты клиентов?")) remove.mutate(ev.id);
        return;
      }
      const msg =
        ev.moderationStatus === "ARCHIVED"
          ? "Удалить мероприятие безвозвратно?"
          : "Удалить черновик?";
      if (confirm(msg)) remove.mutate(ev.id);
    },
    [remove],
  );

  const handleCancelEvent = useCallback(
    (ev: InstructorEventDTO) => {
      const hasRegs = (ev.paidRegistrationCount ?? 0) > 0;
      const msg = hasRegs
        ? "Отменить мероприятие? Все записи участников будут отменены (с возвратом при оплате), мероприятие скроется из ленты."
        : "Отменить мероприятие? Оно будет скрыто или удалено.";
      if (confirm(msg)) cancelEvent.mutate(ev.id);
    },
    [cancelEvent],
  );

  const events = data?.events ?? [];
  const titles = data?.titles ?? [];
  const formLocked = !canEdit;
  const formIsCompleted =
    Boolean(eventAt) && new Date(eventAt).getTime() <= Date.now();

  const groups = {
    draft: events.filter((e) => e.moderationStatus === "DRAFT"),
    pending: events.filter((e) => e.moderationStatus === "PENDING_REVIEW"),
    published: events.filter((e) => e.moderationStatus === "PUBLISHED"),
    rejected: events.filter((e) => e.moderationStatus === "REJECTED"),
    completed: events.filter((e) => e.moderationStatus === "ARCHIVED" && e.isCompleted),
    archived: events.filter((e) => e.moderationStatus === "ARCHIVED" && !e.isCompleted),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Мероприятия</CardTitle>
        <CardDescription>
          Укажите цену участия и лимит мест — клиенты смогут записаться и оплатить через платформу (комиссия 15%).
          В ленте клиентов видны только актуальные «Опубликованные» (после модерации). После даты и времени
          мероприятие автоматически переносится в «Завершённые» и исчезает из ленты.
          Скрытые вручную — в отдельном блоке. Черновики — «На модерацию», затем одобрение в админке.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-3 rounded-lg border border-border bg-muted/20 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (formLocked) {
              toast.error("Выполненное мероприятие нельзя редактировать");
              return;
            }
            if (!title.trim() || !body.trim()) {
              toast.error("Заполните заголовок и текст");
              return;
            }
            saveDraft.mutate();
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {loadedStatus ? (
              <Badge variant="secondary" className="text-xs">
                {moderationStatusLabel(loadedStatus)}
              </Badge>
            ) : null}
            {eventAt ? (
              <CompletionBadge event={{ eventAt, isCompleted: formIsCompleted }} />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-title">Заголовок</Label>
            <Input
              id="event-title"
              list="instructor-event-titles"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => {
                const t = title.trim();
                if (t && data?.titles.some((x) => x.title === t)) void loadByTitle(t);
              }}
              placeholder="Новое название или выберите из списка"
              maxLength={120}
              disabled={formLocked}
              required
            />
            <datalist id="instructor-event-titles">
              {titles.map((t) => (
                <option key={t.id} value={t.title} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-body">Текст</Label>
            <textarea
              id="event-body"
              className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={formLocked}
              maxLength={4000}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-at">Дата и время</Label>
              <Input
                id="event-at"
                type="datetime-local"
                value={eventAt}
                onChange={(e) => setEventAt(e.target.value)}
                disabled={formLocked}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-order">Только для заказа</Label>
              <select
                id="event-order"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                disabled={formLocked}
              >
                <option value="">Все мои заказы</option>
                {activeOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-price">Цена участия, ₽</Label>
              <Input
                id="event-price"
                type="number"
                min={0}
                max={500000}
                step={1}
                placeholder="0 — бесплатно"
                value={priceRub}
                onChange={(e) => setPriceRub(e.target.value)}
                disabled={formLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-max">Лимит мест</Label>
              <Input
                id="event-max"
                type="number"
                min={1}
                max={10000}
                step={1}
                placeholder="Без лимита"
                value={maxRegistrations}
                onChange={(e) => setMaxRegistrations(e.target.value)}
                disabled={formLocked}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!formLocked ? (
              <>
                <Button type="submit" variant="outline" disabled={saveDraft.isPending}>
                  {saveDraft.isPending ? "Сохранение…" : "Сохранить черновик"}
                </Button>
                {editingId ? (
                  <Button
                    type="button"
                    variant="accent"
                    disabled={submitModeration.isPending || saveDraft.isPending}
                    onClick={() => submitModeration.mutate(editingId)}
                  >
                    На модерацию
                  </Button>
                ) : null}
              </>
            ) : formIsCompleted ? (
              <p className="text-sm text-muted-foreground">
                Мероприятие выполнено по дате — редактирование недоступно.
              </p>
            ) : loadedStatus === "PENDING_REVIEW" ? (
              <p className="text-sm text-muted-foreground">На модерации — дождитесь решения администратора.</p>
            ) : loadedStatus === "PUBLISHED" ? (
              <p className="text-sm text-muted-foreground">Опубликовано — для правок создайте новое мероприятие.</p>
            ) : loadedStatus === "ARCHIVED" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Скрыто из ленты клиентов. Можно вернуть в черновик и снова отправить на модерацию (если дата
                  ещё не прошла и нет оплаченных записей).
                </p>
                {editingId && !formIsCompleted ? (
                  <Button
                    type="button"
                    variant="accent"
                    disabled={restoreDraft.isPending}
                    onClick={() => restoreDraft.mutate(editingId)}
                  >
                    Восстановить черновик
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button type="button" variant="ghost" onClick={resetForm}>
              Новое мероприятие
            </Button>
          </div>
        </form>

        <EventList
          title="Черновики"
          events={groups.draft}
          isLoading={isLoading}
          onEdit={handleCardEdit}
          onSubmitModeration={(id) => submitModeration.mutate(id)}
          submitModerationPending={submitModeration.isPending}
          onDelete={handleCardDelete}
          onCancelEvent={handleCancelEvent}
          actionsPending={
            restoreDraft.isPending ||
            submitModeration.isPending ||
            remove.isPending ||
            cancelEvent.isPending
          }
        />
        <EventList
          title="На модерации"
          events={groups.pending}
          onEdit={handleCardEdit}
          hint="Ожидает решения администратора — после одобрения появится в ленте клиентов."
        />
        <EventList
          title="Опубликованные"
          events={groups.published}
          onEdit={handleCardEdit}
          onDelete={handleCardDelete}
          onCancelEvent={handleCancelEvent}
          actionsPending={remove.isPending || cancelEvent.isPending}
        />
        {groups.rejected.length > 0 ? (
          <EventList
            title="Отклонённые"
            events={groups.rejected}
            onEdit={handleCardEdit}
            onSubmitModeration={(id) => submitModeration.mutate(id)}
            submitModerationPending={submitModeration.isPending}
            onDelete={handleCardDelete}
            onCancelEvent={handleCancelEvent}
            actionsPending={
              restoreDraft.isPending ||
              submitModeration.isPending ||
              remove.isPending ||
              cancelEvent.isPending
            }
          />
        ) : null}
        {groups.completed.length > 0 ? (
          <EventList
            title="Завершённые"
            events={groups.completed}
            hint="Дата и время прошли — мероприятие снято с ленты клиентов автоматически."
          />
        ) : null}
        {groups.archived.length > 0 ? (
          <EventList
            title="Скрытые"
            events={groups.archived}
            onEdit={handleCardEdit}
            onSubmitModeration={(id) => submitModeration.mutate(id)}
            submitModerationPending={submitModeration.isPending}
            onDelete={handleCardDelete}
            onCancelEvent={handleCancelEvent}
            actionsPending={
              restoreDraft.isPending ||
              submitModeration.isPending ||
              remove.isPending ||
              cancelEvent.isPending
            }
            hint="Не отображаются у клиентов. «Редактировать» вернёт в черновик; «На модерацию» — снова на проверку."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function EventList({
  title,
  events,
  isLoading,
  hint,
  onEdit,
  onSubmitModeration,
  submitModerationPending,
  onDelete,
  onCancelEvent,
  actionsPending,
}: {
  title: string;
  events: InstructorEventDTO[];
  isLoading?: boolean;
  hint?: string;
  onEdit?: (ev: InstructorEventDTO) => void;
  onSubmitModeration?: (id: string) => void;
  submitModerationPending?: boolean;
  onDelete?: (ev: InstructorEventDTO) => void;
  onCancelEvent?: (ev: InstructorEventDTO) => void;
  actionsPending?: boolean;
}) {
  if (isLoading) return null;
  if (!events.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">
        {title} ({events.length})
      </h3>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <ul className="space-y-2">
        {events.map((ev) => (
          <li key={ev.id} className="rounded-md border border-border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{ev.title}</span>
              <CompletionBadge event={ev} />
              <Badge variant="outline" className="text-[10px]">
                {moderationStatusLabel(ev.moderationStatus)}
              </Badge>
            </div>
            {ev.eventAt ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{formatEventDateRu(ev.eventAt)}</div>
            ) : null}
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatEventPriceRu(ev.priceRub)}
              {ev.maxRegistrations != null ? ` · до ${ev.maxRegistrations} мест` : ""}
              {ev.paidRegistrationCount != null && ev.paidRegistrationCount > 0
                ? ` · записано: ${ev.paidRegistrationCount}`
                : ""}
              {ev.registrationRevenueRub != null && ev.registrationRevenueRub > 0
                ? ` · к выплате: ${ev.registrationRevenueRub.toLocaleString("ru-RU")} ₽`
                : ""}
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{ev.body}</p>
            {ev.rejectNote ? (
              <p className="mt-1 text-xs text-destructive">Отклонено: {ev.rejectNote}</p>
            ) : null}
            {(ev.paidRegistrationCount ?? 0) > 0 ? (
              <EventRegistrantsPanel eventId={ev.id} />
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {onEdit && showEventCardEdit(ev) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => onEdit(ev)}
                >
                  Редактировать
                </Button>
              ) : null}
              {onSubmitModeration && showEventCardModeration(ev) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  disabled={submitModerationPending || actionsPending}
                  onClick={() => onSubmitModeration(ev.id)}
                >
                  На модерацию
                </Button>
              ) : null}
              {onDelete && showEventCardDelete(ev) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => onDelete(ev)}
                >
                  {eventCardDeleteLabel(ev)}
                </Button>
              ) : null}
              {onCancelEvent &&
              !ev.isCompleted &&
              (ev.moderationStatus === "PUBLISHED" ||
                ev.moderationStatus === "ARCHIVED" ||
                (ev.paidRegistrationCount ?? 0) > 0) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={actionsPending}
                  onClick={() => onCancelEvent(ev)}
                >
                  Отменить мероприятие
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
