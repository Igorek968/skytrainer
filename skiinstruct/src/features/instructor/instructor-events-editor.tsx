"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { InstructorEventDTO } from "@/lib/instructor-events";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import {
  canEditInstructorEventPhoto,
  canRestoreArchivedEvent,
  eventCardDeleteLabel,
  isCompletedEventPermanentDelete,
  formatEventDateRu,
  formatEventPriceRu,
  formatSlotTimeRu,
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

type SlotFormRow = {
  id?: string;
  time: string;
  maxSeats: string;
  priceRub: string;
};

type InstructorEventApi = Omit<InstructorEventDTO, "slots" | "hasSlots"> & {
  hasSlots?: boolean;
  eventDay?: string | null;
  slots?: {
    id?: string;
    time: string;
    maxSeats: number | null;
    priceRub: number | null;
    paidCount?: number;
    startsAt?: string;
  }[];
};

const DEFAULT_SLOTS: SlotFormRow[] = [
  { time: "10:00", maxSeats: "4", priceRub: "5000" },
  { time: "14:00", maxSeats: "4", priceRub: "5000" },
  { time: "18:00", maxSeats: "6", priceRub: "6000" },
];

function eventDayFromEventAt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function asEventCard(ev: InstructorEventApi): InstructorEventDTO {
  return ev as unknown as InstructorEventDTO;
}

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
  const [eventDay, setEventDay] = useState("");
  const [useSlots, setUseSlots] = useState(true);
  const [slotRows, setSlotRows] = useState<SlotFormRow[]>(DEFAULT_SLOTS);
  const [orderId, setOrderId] = useState("");
  const [priceRub, setPriceRub] = useState("");
  const [maxRegistrations, setMaxRegistrations] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [loadedStatus, setLoadedStatus] = useState<InstructorEventDTO["moderationStatus"] | null>(null);
  const titleLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const uploadPhotoForEvent = useCallback(async (eventId: string, file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    const r = await instructorFetch(`/api/instructor/events/${eventId}/photo`, {
      method: "POST",
      body: fd,
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string; event?: InstructorEventApi };
    if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "upload");
    return j.event ?? null;
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["instructor-events"],
    queryFn: async () => {
      const r = await instructorFetch("/api/instructor/events");
      if (!r.ok) throw new Error("events");
      return r.json() as Promise<{ events: InstructorEventApi[]; titles: TitleOption[] }>;
    },
    refetchInterval: (query) => {
      const list = query.state.data?.events ?? [];
      return list.some((e) => e.moderationStatus === "PENDING_REVIEW") ? 12_000 : false;
    },
  });

  const loadFormFromEvent = useCallback((ev: InstructorEventApi | InstructorEventDTO) => {
    const api = ev as InstructorEventApi;
    setEditingId(ev.id);
    setTitle(ev.title);
    setBody(ev.body);
    setEventAt(toDatetimeLocalValue(ev.eventAt));
    setEventDay(api.eventDay ?? eventDayFromEventAt(ev.eventAt));
    const slotList = api.slots ?? [];
    const hasSlotRows = Boolean(api.hasSlots && slotList.length > 0);
    setUseSlots(hasSlotRows || !ev.eventAt);
    if (hasSlotRows && slotList.length) {
      setSlotRows(
        slotList.map((s) => ({
          id: s.id,
          time: s.time ?? (s.startsAt ? formatSlotTimeRu(s.startsAt) : "10:00"),
          maxSeats: s.maxSeats != null ? String(s.maxSeats) : "",
          priceRub: s.priceRub != null && s.priceRub > 0 ? String(s.priceRub) : "",
        })),
      );
    } else if (!ev.eventAt) {
      setSlotRows(DEFAULT_SLOTS);
    }
    setOrderId(ev.orderId ?? "");
    setPriceRub(ev.priceRub != null && ev.priceRub > 0 ? String(ev.priceRub) : "");
    setMaxRegistrations(
      ev.maxRegistrations != null ? String(ev.maxRegistrations) : "",
    );
    setPhotoUrl(ev.photoUrl ?? "");
    setPhotoFile(null);
    setCanEdit(ev.canEdit);
    setLoadedStatus(ev.moderationStatus);
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setEventAt("");
    setEventDay("");
    setUseSlots(true);
    setSlotRows(DEFAULT_SLOTS);
    setOrderId("");
    setPriceRub("");
    setMaxRegistrations("");
    setPhotoUrl("");
    setPhotoFile(null);
    setCanEdit(true);
    setLoadedStatus(null);
  }, []);

  const loadByTitle = useCallback(
    async (titleValue: string) => {
      const t = titleValue.trim();
      if (!t) return;
      const r = await instructorFetch(`/api/instructor/events/by-title?title=${encodeURIComponent(t)}`);
      if (!r.ok) return;
      const j = (await r.json()) as { event: InstructorEventApi | null };
      if (j.event) {
        loadFormFromEvent(j.event);
        toast.message("Подгружено мероприятие с этим названием");
      } else {
        setEditingId(null);
        setBody("");
        setEventAt("");
        setEventDay("");
        setSlotRows(DEFAULT_SLOTS);
        setOrderId("");
        setPriceRub("");
        setMaxRegistrations("");
        setPhotoUrl("");
        setPhotoFile(null);
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

      if (useSlots) {
        if (!eventDay.trim()) throw new Error("Укажите день мероприятия");
        payload.eventDay = eventDay.trim();
        payload.slots = slotRows
          .filter((s) => s.time.trim())
          .map((s) => {
            const maxParsed = s.maxSeats.trim() ? Number.parseInt(s.maxSeats.trim(), 10) : NaN;
            const priceParsed = s.priceRub.trim() ? Number.parseInt(s.priceRub.trim(), 10) : NaN;
            return {
              id: s.id,
              time: s.time.trim(),
              maxSeats: Number.isFinite(maxParsed) && maxParsed >= 1 ? maxParsed : null,
              priceRub: Number.isFinite(priceParsed) && priceParsed >= 0 ? priceParsed : null,
            };
          });
        if (!(payload.slots as unknown[]).length) {
          throw new Error("Добавьте хотя бы один выход");
        }
      } else {
        if (eventAt.trim()) payload.eventAt = new Date(eventAt).toISOString();
        const priceParsed = priceRub.trim() ? Number.parseInt(priceRub.trim(), 10) : NaN;
        payload.priceRub =
          Number.isFinite(priceParsed) && priceParsed >= 0 ? priceParsed : null;
        const maxParsed = maxRegistrations.trim()
          ? Number.parseInt(maxRegistrations.trim(), 10)
          : NaN;
        payload.maxRegistrations =
          Number.isFinite(maxParsed) && maxParsed >= 1 ? maxParsed : null;
      }

      const r = await instructorFetch("/api/instructor/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "save");
      }
      let result = (await r.json()) as { event: InstructorEventApi };
      if (photoFile && result.event.id) {
        const withPhoto = await uploadPhotoForEvent(result.event.id, photoFile);
        if (withPhoto) result = { event: withPhoto };
      }
      return result;
    },
    onSuccess: async (j) => {
      loadFormFromEvent(j.event);
      setPhotoFile(null);
      toast.success(j.event.photoUrl ? "Черновик и фото сохранены" : "Черновик сохранён");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) => toast.error(e.message === "save" ? "Не удалось сохранить" : e.message),
  });

  const submitModeration = useMutation({
    mutationFn: async (id: string) => {
      if (photoFile) {
        const uploaded = await uploadPhotoForEvent(id, photoFile);
        if (!uploaded) throw new Error("upload");
      }
      const r = await instructorFetch(`/api/instructor/events/${id}/submit`, { method: "POST" });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "submit");
      }
      return r.json() as Promise<{ event: InstructorEventApi; message?: string }>;
    },
    onSuccess: async (j) => {
      loadFormFromEvent(j.event);
      setPhotoFile(null);
      toast.success(j.message ?? "Отправлено на модерацию");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "submit"
          ? "Не удалось отправить"
          : e.message === "upload"
            ? "Не удалось загрузить фото перед отправкой"
            : e.message,
      ),
  });

  const restoreDraft = useMutation({
    mutationFn: async (id: string) => {
      const r = await instructorFetch(`/api/instructor/events/${id}/restore`, { method: "POST" });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "restore");
      }
      return r.json() as Promise<{ event: InstructorEventApi; message?: string }>;
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

  const uploadPhoto = useMutation({
    mutationFn: async () => {
      if (!editingId || !photoFile) throw new Error("no-file");
      const event = await uploadPhotoForEvent(editingId, photoFile);
      if (!event) throw new Error("upload");
      return { event };
    },
    onSuccess: async (j) => {
      if (j.event) loadFormFromEvent(j.event);
      setPhotoFile(null);
      toast.success("Фото загружено");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) =>
      toast.error(e.message === "upload" ? "Не удалось загрузить фото" : e.message),
  });

  const removePhoto = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("no-event");
      const r = await instructorFetch(`/api/instructor/events/${editingId}/photo`, {
        method: "DELETE",
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; event?: InstructorEventApi };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "remove-photo");
      return j;
    },
    onSuccess: async (j) => {
      if (j.event) loadFormFromEvent(j.event);
      else setPhotoUrl("");
      setPhotoFile(null);
      toast.success("Фото удалено");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) =>
      toast.error(e.message === "remove-photo" ? "Не удалось удалить фото" : e.message),
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
    onError: (e: Error) => {
      const msg = e.message === "delete" ? "Не удалось выполнить действие" : e.message;
      if (msg.includes("напоминания")) {
        toast.message(msg, { duration: 8000 });
      } else {
        toast.error(msg);
      }
    },
  });

  const handleCardEdit = useCallback(
    (ev: InstructorEventApi) => {
      if (canRestoreArchivedEvent(asEventCard(ev))) {
        restoreDraft.mutate(ev.id);
        return;
      }
      loadFormFromEvent(ev);
    },
    [loadFormFromEvent, restoreDraft],
  );

  const handleCardDelete = useCallback(
    (ev: InstructorEventApi) => {
      if (isCompletedEventPermanentDelete(asEventCard(ev))) {
        const hasRegs = (ev.paidRegistrationCount ?? 0) > 0;
        const unconfirmed = ev.unconfirmedAttendanceCount ?? 0;
        const msg = hasRegs
          ? unconfirmed > 0
            ? `Удалить завершённое мероприятие? ${unconfirmed} участник(ов) ещё не подтвердили участие — им будет отправлено напоминание.`
            : "Удалить завершённое мероприятие? Записи участников также будут удалены."
          : "Удалить завершённое мероприятие?";
        if (confirm(msg)) remove.mutate(ev.id);
        return;
      }
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
    (ev: InstructorEventApi) => {
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
  const effectiveEventAt =
    eventDay.trim() !== ""
      ? new Date(`${eventDay.trim()}T23:59:59`)
      : eventAt.trim()
        ? new Date(eventAt)
        : null;
  const photoEditable =
    Boolean(editingId && loadedStatus) &&
    canEditInstructorEventPhoto({
      eventAt: effectiveEventAt,
      moderationStatus: loadedStatus!,
    });
  const displayPhotoSrc =
    photoPreview ?? (photoUrl ? (publicUploadDisplaySrc(photoUrl) ?? photoUrl) : null);
  const formIsCompleted =
    Boolean(effectiveEventAt) && effectiveEventAt!.getTime() <= Date.now();

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
          Создайте мероприятие с несколькими выходами в день (например, катание на яхте в 10:00, 14:00 и 18:00).
          Для каждого выхода — своё время, цена и лимит мест. Клиент записывается на конкретное время; вы
          получаете email о каждой новой записи. Оплата после мероприятия (комиссия 15%).
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
            if (useSlots && !eventDay.trim()) {
              toast.error("Укажите день мероприятия");
              return;
            }
            if (!useSlots && !eventAt.trim()) {
              toast.error("Укажите дату и время");
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
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-photo">Фото мероприятия</Label>
            {displayPhotoSrc ? (
              <div className="max-w-sm space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayPhotoSrc}
                  alt="Фото мероприятия"
                  className="aspect-[16/9] w-full rounded-md border border-border object-cover"
                />
                {photoPreview ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Предпросмотр — нажмите «Сохранить черновик» или «Загрузить фото»
                  </p>
                ) : null}
                {photoEditable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={removePhoto.isPending || uploadPhoto.isPending || Boolean(photoPreview)}
                    onClick={() => removePhoto.mutate()}
                  >
                    Удалить фото
                  </Button>
                ) : null}
              </div>
            ) : null}
            {photoEditable ? (
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  id="event-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="max-w-xs"
                  disabled={uploadPhoto.isPending || saveDraft.isPending}
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!editingId || !photoFile || uploadPhoto.isPending || saveDraft.isPending}
                  onClick={() => uploadPhoto.mutate()}
                >
                  {uploadPhoto.isPending ? "Загрузка…" : "Загрузить фото"}
                </Button>
              </div>
            ) : formLocked && loadedStatus === "PUBLISHED" && !photoUrl ? (
              <p className="text-xs text-muted-foreground">
                Фото не загружено. Откройте мероприятие из списка «Опубликованные» → «Добавить фото».
              </p>
            ) : null}
            {photoEditable ? (
              <p className="text-xs text-muted-foreground">
                JPG, PNG или WEBP до 5 MB. Фото сохраняется при «Сохранить черновик», «Загрузить фото» или «На модерацию».
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-md border border-border/80 bg-background p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-sm font-medium">Формат</Label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="event-format"
                  checked={useSlots}
                  disabled={formLocked}
                  onChange={() => setUseSlots(true)}
                />
                Несколько выходов в день
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="event-format"
                  checked={!useSlots}
                  disabled={formLocked}
                  onChange={() => setUseSlots(false)}
                />
                Одно время (классика)
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {useSlots ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="event-day">День мероприятия</Label>
                  <Input
                    id="event-day"
                    type="date"
                    value={eventDay}
                    onChange={(e) => setEventDay(e.target.value)}
                    disabled={formLocked}
                    required={useSlots}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="event-at">Дата и время</Label>
                  <Input
                    id="event-at"
                    type="datetime-local"
                    value={eventAt}
                    onChange={(e) => setEventAt(e.target.value)}
                    disabled={formLocked}
                    required={!useSlots}
                  />
                </div>
              )}
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
            </div>

            {useSlots ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Выходы в этот день</Label>
                  {!formLocked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSlotRows((rows) => [...rows, { time: "12:00", maxSeats: "4", priceRub: "" }])
                      }
                    >
                      + Добавить выход
                    </Button>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-2 py-2 font-medium">Время</th>
                        <th className="px-2 py-2 font-medium">Мест</th>
                        <th className="px-2 py-2 font-medium">Цена, ₽</th>
                        {!formLocked ? <th className="px-2 py-2 w-10" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {slotRows.map((row, idx) => (
                        <tr key={row.id ?? `new-${idx}`} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-1.5">
                            <Input
                              type="time"
                              value={row.time}
                              disabled={formLocked}
                              onChange={(e) =>
                                setSlotRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, time: e.target.value } : r)),
                                )
                              }
                              className="h-9"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={10000}
                              placeholder="∞"
                              value={row.maxSeats}
                              disabled={formLocked}
                              onChange={(e) =>
                                setSlotRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, maxSeats: e.target.value } : r)),
                                )
                              }
                              className="h-9"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={500000}
                              placeholder="0"
                              value={row.priceRub}
                              disabled={formLocked}
                              onChange={(e) =>
                                setSlotRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, priceRub: e.target.value } : r)),
                                )
                              }
                              className="h-9"
                            />
                          </td>
                          {!formLocked ? (
                            <td className="px-2 py-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 p-0 text-muted-foreground"
                                disabled={slotRows.length <= 1}
                                onClick={() => setSlotRows((rows) => rows.filter((_, i) => i !== idx))}
                              >
                                ×
                              </Button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Пример: «Катаю на яхте» — три выхода с разным временем, лимитом и ценой. Клиент выбирает слот в
                  ленте.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
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
            )}
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

        {editingId ? (
          <div className="rounded-lg border border-border bg-muted/10 p-4">
            <h3 className="text-sm font-medium">Заявки на участие</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Все записавшиеся участники. После мероприятия они подтверждают участие; для платных событий оплата
              списывается при подтверждении.
            </p>
            <EventRegistrantsPanel eventId={editingId} />
          </div>
        ) : null}

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
            onDelete={handleCardDelete}
            actionsPending={remove.isPending}
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
  events: InstructorEventApi[];
  isLoading?: boolean;
  hint?: string;
  onEdit?: (ev: InstructorEventApi) => void;
  onSubmitModeration?: (id: string) => void;
  submitModerationPending?: boolean;
  onDelete?: (ev: InstructorEventApi) => void;
  onCancelEvent?: (ev: InstructorEventApi) => void;
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
            {ev.photoUrl ? (
              <div className="mt-2 max-w-xs overflow-hidden rounded-md border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicUploadDisplaySrc(ev.photoUrl) ?? ev.photoUrl ?? ""}
                  alt={ev.title}
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
            ) : null}
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatEventPriceRu(ev.priceRub)}
              {ev.maxRegistrations != null ? ` · до ${ev.maxRegistrations} мест` : ""}
              {ev.paidRegistrationCount != null && ev.paidRegistrationCount > 0
                ? ` · заявок: ${ev.paidRegistrationCount}`
                : ""}
              {ev.unconfirmedAttendanceCount != null && ev.unconfirmedAttendanceCount > 0
                ? ` · не подтвердили: ${ev.unconfirmedAttendanceCount}`
                : ""}
              {ev.registrationRevenueRub != null && ev.registrationRevenueRub > 0
                ? ` · к выплате: ${ev.registrationRevenueRub.toLocaleString("ru-RU")} ₽`
                : ""}
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{ev.body}</p>
            {ev.rejectNote ? (
              <p className="mt-1 text-xs text-destructive">Отклонено: {ev.rejectNote}</p>
            ) : null}
            {ev.moderationStatus === "PUBLISHED" ||
            ev.moderationStatus === "ARCHIVED" ||
            (ev.paidRegistrationCount ?? 0) > 0 ? (
              <EventRegistrantsPanel eventId={ev.id} />
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {onEdit && showEventCardEdit(asEventCard(ev)) ? (
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
              {onEdit &&
              ev.moderationStatus === "PUBLISHED" &&
              !ev.photoUrl &&
              !ev.isCompleted ? (
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  disabled={actionsPending}
                  onClick={() => onEdit(ev)}
                >
                  Добавить фото
                </Button>
              ) : null}
              {onSubmitModeration && showEventCardModeration(asEventCard(ev)) ? (
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
              {onDelete && showEventCardDelete(asEventCard(ev)) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => onDelete(ev)}
                >
                  {eventCardDeleteLabel(asEventCard(ev))}
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
