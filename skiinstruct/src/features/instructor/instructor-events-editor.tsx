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
  showEventCardHide,
  showEventCardModeration,
  toDatetimeLocalValue,
} from "@/lib/instructor-events";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { EventRegistrantsPanel } from "@/features/instructor/event-registrants-panel";
import { EventVenuePicker, type EventVenueValue } from "@/features/instructor/event-venue-picker";
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
  venueAddress?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
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

const EMPTY_VENUE: EventVenueValue = { address: "", lat: null, lng: null };

function venueFromEvent(ev: InstructorEventApi | InstructorEventDTO): EventVenueValue {
  return {
    address: ev.venueAddress ?? "",
    lat: ev.venueLat ?? null,
    lng: ev.venueLng ?? null,
  };
}

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
  embedded = false,
}: {
  activeOrders?: ActiveOrderOption[];
  /** Внутри карточки «Профиль инструктора» — без отдельной обёртки Card. */
  embedded?: boolean;
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
  const [templatePhotoSourceId, setTemplatePhotoSourceId] = useState<string | null>(null);
  const [useSimilarTemplate, setUseSimilarTemplate] = useState(false);
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [venue, setVenue] = useState<EventVenueValue>(EMPTY_VENUE);
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

  const fillTemplateFromEvent = useCallback((ev: InstructorEventApi, opts?: { keepTitle?: boolean }) => {
    const api = ev as InstructorEventApi;
    setEditingId(null);
    if (opts?.keepTitle !== false) setTitle(ev.title);
    setBody(ev.body);
    setEventAt("");
    setEventDay("");
    const slotList = api.slots ?? [];
    const hasSlotRows = Boolean(api.hasSlots && slotList.length > 0);
    setUseSlots(hasSlotRows || !ev.eventAt);
    if (hasSlotRows && slotList.length) {
      setSlotRows(
        slotList.map((s) => ({
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
    setMaxRegistrations(ev.maxRegistrations != null ? String(ev.maxRegistrations) : "");
    setPhotoUrl(ev.photoUrl ?? "");
    setPhotoFile(null);
    setTemplatePhotoSourceId(ev.photoUrl ? ev.id : null);
    setVenue(venueFromEvent(ev));
    setRepeatDaily(Boolean(ev.repeatDaily));
    setCanEdit(true);
    setLoadedStatus(null);
  }, []);

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
    setTemplatePhotoSourceId(null);
    setVenue(venueFromEvent(ev));
    setRepeatDaily(Boolean(ev.repeatDaily));
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
    setTemplatePhotoSourceId(null);
    setUseSimilarTemplate(false);
    setRepeatDaily(false);
    setVenue(EMPTY_VENUE);
    setCanEdit(true);
    setLoadedStatus(null);
  }, []);

  const fillTemplateByTitle = useCallback(
    async (titleValue: string) => {
      const t = titleValue.trim();
      if (!t) return;
      const r = await instructorFetch(`/api/instructor/events/by-title?title=${encodeURIComponent(t)}`);
      if (!r.ok) return;
      const j = (await r.json()) as { event: InstructorEventApi | null };
      if (j.event) {
        fillTemplateFromEvent(j.event);
        toast.message("Подставлены текст, цена и фото с прошлого раза — укажите новую дату");
      }
    },
    [fillTemplateFromEvent],
  );

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (titleLoadTimer.current) clearTimeout(titleLoadTimer.current);
    if (!useSimilarTemplate) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const known = data?.titles.some((t) => t.title.toLowerCase() === trimmed.toLowerCase());
    if (known) {
      titleLoadTimer.current = setTimeout(() => void fillTemplateByTitle(trimmed), 400);
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
        repeatDaily,
      };

      const venueAddress = venue.address.trim();
      if (venueAddress) {
        if (venue.lat == null || venue.lng == null) {
          throw new Error("Укажите адрес на карте — нажмите «Найти» или выберите точку кликом");
        }
        payload.venueAddress = venueAddress;
        payload.venueLat = venue.lat;
        payload.venueLng = venue.lng;
      } else {
        payload.venueAddress = null;
        payload.venueLat = null;
        payload.venueLng = null;
      }

      if (!editingId && templatePhotoSourceId && !photoFile) {
        payload.copyPhotoFromEventId = templatePhotoSourceId;
      }

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
      setTemplatePhotoSourceId(null);
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

  const setRepeatDailyMutation = useMutation({
    mutationFn: async ({ id, repeatDaily: next }: { id: string; repeatDaily: boolean }) => {
      const r = await instructorFetch(`/api/instructor/events/${id}/repeat-daily`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repeatDaily: next }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; event?: InstructorEventApi };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "repeat-daily");
      return j;
    },
    onSuccess: async (j, { repeatDaily: next }) => {
      toast.success(
        next
          ? "Каждый день: после окончания создаётся копия на следующий день"
          : "Ежедневное размещение отключено",
      );
      if (j.event && editingId === j.event.id) loadFormFromEvent(j.event);
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    },
    onError: (e: Error) =>
      toast.error(e.message === "repeat-daily" ? "Не удалось изменить настройку" : e.message),
  });

  const remove = useMutation({
    mutationFn: async ({ id, hard }: { id: string; hard?: boolean }) => {
      const qs = hard ? "?hard=1" : "";
      const r = await instructorFetch(`/api/instructor/events/${id}${qs}`, { method: "DELETE" });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "delete");
      }
      return r.json() as Promise<{ archived?: boolean }>;
    },
    onSuccess: async (data, { id }) => {
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

  const handleDuplicate = useCallback(
    (ev: InstructorEventApi) => {
      fillTemplateFromEvent(ev);
      toast.message("Новое мероприятие по образцу — укажите дату и сохраните черновик");
    },
    [fillTemplateFromEvent],
  );

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

  const handleCardHide = useCallback(
    (ev: InstructorEventApi) => {
      if (confirm("Скрыть из ленты клиентов?")) remove.mutate({ id: ev.id });
    },
    [remove],
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
        if (confirm(msg)) remove.mutate({ id: ev.id, hard: true });
        return;
      }
      const msg =
        ev.moderationStatus === "PUBLISHED"
          ? "Удалить мероприятие безвозвратно? Оно исчезнет из ленты и из списка."
          : ev.moderationStatus === "ARCHIVED"
            ? "Удалить мероприятие безвозвратно?"
            : ev.moderationStatus === "PENDING_REVIEW"
              ? "Удалить мероприятие с модерации?"
              : "Удалить черновик?";
      if (confirm(msg)) {
        remove.mutate({
          id: ev.id,
          hard: ev.moderationStatus === "PUBLISHED",
        });
      }
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
  const canPickPhoto = !formLocked && (!editingId || photoEditable);
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

  const editorContent = (
    <div className={embedded ? "space-y-6" : undefined}>
      <CardContent className={embedded ? "p-0" : "space-y-6"}>
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
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="event-title" className="mb-0">
                Заголовок
              </Label>
              {title.trim() &&
              data?.titles.some((t) => t.title.toLowerCase() === title.trim().toLowerCase()) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={formLocked}
                  onClick={() => void fillTemplateByTitle(title)}
                >
                  Как у прошлого
                </Button>
              ) : null}
            </div>
            <Input
              id="event-title"
              list="instructor-event-titles"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => {
                if (!useSimilarTemplate) return;
                const t = title.trim();
                if (t && data?.titles.some((x) => x.title === t)) void fillTemplateByTitle(t);
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
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={useSimilarTemplate}
                disabled={formLocked}
                onChange={(e) => setUseSimilarTemplate(e.target.checked)}
              />
              При выборе знакомого названия подставлять текст, цену и фото с прошлого раза
            </label>
          </div>

          <div className="space-y-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4 sm:space-y-0">
            <div className="space-y-2">
              <Label htmlFor="event-body">Текст</Label>
              <textarea
                id="event-body"
                className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={formLocked}
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-2 sm:w-52">
              <Label htmlFor="event-photo">Фото</Label>
              {displayPhotoSrc ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayPhotoSrc}
                    alt="Фото мероприятия"
                    className="aspect-[16/9] w-full rounded-md border border-border object-cover"
                  />
                  {photoPreview ? (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Предпросмотр — сохраните черновик
                    </p>
                  ) : templatePhotoSourceId && !editingId ? (
                    <p className="text-[11px] text-muted-foreground">С прошлого раза — скопируется при сохранении</p>
                  ) : null}
                  {photoEditable && photoUrl && !photoPreview ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 w-full text-xs"
                      disabled={removePhoto.isPending || uploadPhoto.isPending || Boolean(photoPreview)}
                      onClick={() => removePhoto.mutate()}
                    >
                      Удалить фото
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {canPickPhoto ? (
                <div className="space-y-2">
                  <Input
                    id="event-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="text-xs"
                    disabled={uploadPhoto.isPending || saveDraft.isPending}
                    onChange={(e) => {
                      setPhotoFile(e.target.files?.[0] ?? null);
                      setTemplatePhotoSourceId(null);
                    }}
                  />
                  {editingId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full text-xs"
                      disabled={!photoFile || uploadPhoto.isPending || saveDraft.isPending}
                      onClick={() => uploadPhoto.mutate()}
                    >
                      {uploadPhoto.isPending ? "Загрузка…" : "Загрузить фото"}
                    </Button>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    JPG, PNG, WEBP до 5 MB. {!editingId ? "Можно выбрать до сохранения черновика." : null}
                  </p>
                </div>
              ) : formLocked && loadedStatus === "PUBLISHED" && !photoUrl ? (
                <p className="text-xs text-muted-foreground">
                  Фото не загружено. В списке — «Добавить фото».
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-border/80 bg-background p-3">
            <EventVenuePicker value={venue} onChange={setVenue} disabled={formLocked} />
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

          {!formLocked ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={repeatDaily}
                onChange={(e) => setRepeatDaily(e.target.checked)}
              />
              <span>
                <span className="font-medium">Размещать каждый день</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  После окончания мероприятия автоматически создаётся копия на следующий день (то же время,
                  текст, фото и адрес). Настройка применится после публикации.
                </span>
              </span>
            </label>
          ) : repeatDaily ? (
            <p className="text-xs text-muted-foreground">
              Включено ежедневное размещение — после окончания создаётся копия на следующий день.
            </p>
          ) : null}

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
                  Скрыто из ленты и с карты. Верните в черновик, чтобы править; затем «На модерацию». Или сразу
                  отправьте на модерацию без правок.
                </p>
                {editingId && !formIsCompleted ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={restoreDraft.isPending || submitModeration.isPending}
                      onClick={() => restoreDraft.mutate(editingId)}
                    >
                      Восстановить черновик
                    </Button>
                    <Button
                      type="button"
                      variant="accent"
                      disabled={restoreDraft.isPending || submitModeration.isPending}
                      onClick={() => submitModeration.mutate(editingId)}
                    >
                      Восстановить и на модерацию
                    </Button>
                  </div>
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
          onDuplicate={handleDuplicate}
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
          onDuplicate={handleDuplicate}
          onDelete={handleCardDelete}
          actionsPending={remove.isPending}
          hint="Ожидает решения администратора — после одобрения появится в ленте и на карте (если указано место)."
        />
        <EventList
          title="Опубликованные"
          events={groups.published}
          onEdit={handleCardEdit}
          onDuplicate={handleDuplicate}
          onHide={handleCardHide}
          onDelete={handleCardDelete}
          onCancelEvent={handleCancelEvent}
          onRepeatDaily={(id, next) => setRepeatDailyMutation.mutate({ id, repeatDaily: next })}
          repeatDailyPending={setRepeatDailyMutation.isPending}
          actionsPending={remove.isPending || cancelEvent.isPending || setRepeatDailyMutation.isPending}
        />
        {groups.rejected.length > 0 ? (
          <EventList
            title="Отклонённые"
            events={groups.rejected}
            onEdit={handleCardEdit}
            onDuplicate={handleDuplicate}
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
            onDuplicate={handleDuplicate}
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
            hint="Не в ленте и не на карте. «Редактировать» / «Восстановить черновик» — правки; «Восстановить и на модерацию» — сразу на проверку."
          />
        ) : null}
      </CardContent>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Черновик → «На модерацию» → после одобрения видно в ленте и на карте (точка по месту мероприятия).
          Скрытое: «Восстановить черновик» для правок или «Восстановить и на модерацию».
        </p>
        {editorContent}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Мероприятия</CardTitle>
        <CardDescription>
          Черновик → «На модерацию» → после одобрения админом мероприятие видно в ленте клиентов и на карте
          (оранжевая точка по адресу места). Скрытое: «Восстановить черновик» для правок или «Восстановить и на
          модерацию» без правок.
        </CardDescription>
      </CardHeader>
      {editorContent}
    </Card>
  );
}

function EventList({
  title,
  events,
  isLoading,
  hint,
  onEdit,
  onDuplicate,
  onSubmitModeration,
  submitModerationPending,
  onHide,
  onDelete,
  onCancelEvent,
  onRepeatDaily,
  repeatDailyPending,
  actionsPending,
}: {
  title: string;
  events: InstructorEventApi[];
  isLoading?: boolean;
  hint?: string;
  onEdit?: (ev: InstructorEventApi) => void;
  onDuplicate?: (ev: InstructorEventApi) => void;
  onSubmitModeration?: (id: string) => void;
  submitModerationPending?: boolean;
  onHide?: (ev: InstructorEventApi) => void;
  onDelete?: (ev: InstructorEventApi) => void;
  onCancelEvent?: (ev: InstructorEventApi) => void;
  onRepeatDaily?: (id: string, repeatDaily: boolean) => void;
  repeatDailyPending?: boolean;
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
              {ev.repeatDaily ? (
                <Badge variant="secondary" className="text-[10px]">
                  Каждый день
                </Badge>
              ) : null}
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
            {onRepeatDaily && ev.moderationStatus === "PUBLISHED" && !ev.isCompleted ? (
              <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={Boolean(ev.repeatDaily)}
                  disabled={repeatDailyPending || actionsPending}
                  onChange={(e) => onRepeatDaily(ev.id, e.target.checked)}
                />
                <span>
                  <span className="font-medium">Размещать каждый день</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    После окончания автоматически создаётся копия на следующий день (то же время, текст и
                    фото).
                  </span>
                </span>
              </label>
            ) : null}
            {ev.moderationStatus === "PUBLISHED" ||
            ev.moderationStatus === "ARCHIVED" ||
            (ev.paidRegistrationCount ?? 0) > 0 ? (
              <EventRegistrantsPanel eventId={ev.id} />
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {onDuplicate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => onDuplicate(ev)}
                >
                  Похожее
                </Button>
              ) : null}
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
                  {ev.moderationStatus === "ARCHIVED"
                    ? "Восстановить и на модерацию"
                    : "На модерацию"}
                </Button>
              ) : null}
              {onHide && showEventCardHide(asEventCard(ev)) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => onHide(ev)}
                >
                  Скрыть из ленты
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
