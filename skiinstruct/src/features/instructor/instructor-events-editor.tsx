"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { InstructorEventDTO, ClientInstructorEventDTO } from "@/lib/instructor-events";
import type { ClientEventFeedCardDTO, InstructorCatalogBrowseItemDTO } from "@/lib/event-catalog";
import { eventCategoryOptions } from "@/lib/event-category";
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
import { EventViewerOverlay } from "@/features/orders/event-viewer-overlay";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { EventRegistrantsPanel } from "@/features/instructor/event-registrants-panel";
import { EventVenuePicker, type EventVenueValue } from "@/features/instructor/event-venue-picker";
import { compressImageFile } from "@/lib/compress-image-client";
import { cn } from "@/lib/utils";

type ActiveOrderOption = { id: string; label: string };

export type EventCreateLeaveGuard = {
  shouldConfirmLeave: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
};

type SlotFormRow = {
  id?: string;
  date: string;
  time: string;
  title: string;
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
    date?: string | null;
    time: string;
    title?: string | null;
    maxSeats: number | null;
    priceRub: number | null;
    paidCount?: number;
    startsAt?: string;
  }[];
};

function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return todayYmd();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function newLocalSlotId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatYmdRu(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return ymd;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function slotStartsAtIso(date: string, time: string): string {
  const d = new Date(`${date.trim()}T${time.trim()}:00`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

const DEFAULT_SLOTS: SlotFormRow[] = [];

function defaultSlotsForToday(): SlotFormRow[] {
  return DEFAULT_SLOTS;
}

function slotRowsFromApi(
  slotList: NonNullable<InstructorEventApi["slots"]>,
  fallbackDay: string,
): SlotFormRow[] {
  return slotList.map((s) => ({
    id: s.id,
    date: s.date?.trim() || (s.startsAt ? eventDayFromEventAt(s.startsAt) : fallbackDay) || todayYmd(),
    time: s.time ?? (s.startsAt ? formatSlotTimeRu(s.startsAt) : "10:00"),
    title: s.title?.trim() ?? "",
    maxSeats: s.maxSeats != null ? String(s.maxSeats) : "",
    priceRub: s.priceRub != null && s.priceRub > 0 ? String(s.priceRub) : "",
  }));
}

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

/** Подсказка: похожая карточка уже есть в каталоге — лучше присоединиться. */
function CatalogSoftDupeHint({ title }: { title: string }) {
  const q = title.trim();
  const { data } = useQuery({
    queryKey: ["instructor-catalog-soft-dupe", q],
    enabled: q.length >= 3,
    queryFn: async () => {
      const params = new URLSearchParams({ q });
      const r = await instructorFetch(`/api/instructor/event-catalog?${params}`);
      if (!r.ok) return { items: [] as InstructorCatalogBrowseItemDTO[] };
      return r.json() as Promise<{ items: InstructorCatalogBrowseItemDTO[] }>;
    },
    staleTime: 15_000,
  });

  const matches = (data?.items ?? [])
    .filter((item) => item.title.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(item.title.toLowerCase()))
    .slice(0, 3);

  if (!matches.length) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-medium">Похожее уже есть в каталоге</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
        Чтобы не дублировать ленту, присоединитесь к карточке выше (блок «Каталог мероприятий») со своей
        ценой и сервисом:
      </p>
      <ul className="mt-1 list-inside list-disc">
        {matches.map((m) => (
          <li key={m.id}>
            {m.title}
            {m.venueAddress ? ` · ${m.venueAddress}` : null}
          </li>
        ))}
      </ul>
    </div>
  );
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
  activeOrders: _activeOrders = [],
  embedded = false,
  view = "all",
  onRequestCreateView,
  onLeaveGuardReady,
}: {
  activeOrders?: ActiveOrderOption[];
  /** Внутри карточки «Профиль инструктора» — без отдельной обёртки Card. */
  embedded?: boolean;
  /** Какой блок показать: форма создания, списки или всё сразу. */
  view?: "all" | "create" | "list" | "saved" | "past";
  /** При редактировании из списка — переключить оболочку на панель создания. */
  onRequestCreateView?: () => void;
  /** Guard при уходе со страницы создания без отправки на модерацию. */
  onLeaveGuardReady?: (guard: EventCreateLeaveGuard | null) => void;
}) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [useSlots, setUseSlots] = useState(true);
  const [slotRows, setSlotRows] = useState<SlotFormRow[]>(() => defaultSlotsForToday());
  const [draftSlotDate, setDraftSlotDate] = useState(() => todayYmd());
  const [draftSlotTime, setDraftSlotTime] = useState("10:00");
  const [draftSlotPrice, setDraftSlotPrice] = useState("");
  const [draftSlotSeats, setDraftSlotSeats] = useState("4");
  const [priceRub, setPriceRub] = useState("");
  const [maxRegistrations, setMaxRegistrations] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [templatePhotoSourceId, setTemplatePhotoSourceId] = useState<string | null>(null);
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [venue, setVenue] = useState<EventVenueValue>(EMPTY_VENUE);
  const [canEdit, setCanEdit] = useState(true);
  const [loadedStatus, setLoadedStatus] = useState<InstructorEventDTO["moderationStatus"] | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCard, setPreviewCard] = useState<ClientEventFeedCardDTO | null>(null);
  const [sendToModerationPending, setSendToModerationPending] = useState(false);
  const formSnapshotRef = useRef("");

  function captureFormSnapshot(next?: {
    title: string;
    body: string;
    category: string;
    eventAt: string;
    useSlots: boolean;
    slotRows: SlotFormRow[];
    priceRub: string;
    maxRegistrations: string;
    venue: EventVenueValue;
    repeatDaily: boolean;
    photoUrl: string;
    photoFileName: string | null;
    templatePhotoSourceId: string | null;
  }) {
    const snap =
      next ??
      ({
        title,
        body,
        category,
        eventAt,
        useSlots,
        slotRows,
        priceRub,
        maxRegistrations,
        venue,
        repeatDaily,
        photoUrl,
        photoFileName: photoFile?.name ?? null,
        templatePhotoSourceId,
      } as const);
    formSnapshotRef.current = JSON.stringify(snap);
  }

  function isFormDirtyNow(): boolean {
    return (
      JSON.stringify({
        title,
        body,
        category,
        eventAt,
        useSlots,
        slotRows,
        priceRub,
        maxRegistrations,
        venue,
        repeatDaily,
        photoUrl,
        photoFileName: photoFile?.name ?? null,
        templatePhotoSourceId,
      }) !== formSnapshotRef.current
    );
  }

  function formHasContent(): boolean {
    return Boolean(
      title.trim() ||
        body.trim() ||
        category.trim() ||
        eventAt.trim() ||
        photoFile ||
        photoUrl.trim() ||
        slotRows.some((s) => s.date.trim() && s.time.trim()) ||
        venue.address.trim(),
    );
  }

  useEffect(() => {
    captureFormSnapshot({
      title: "",
      body: "",
      category: "",
      eventAt: "",
      useSlots: true,
      slotRows: defaultSlotsForToday(),
      priceRub: "",
      maxRegistrations: "",
      venue: EMPTY_VENUE,
      repeatDaily: false,
      photoUrl: "",
      photoFileName: null,
      templatePhotoSourceId: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial empty snapshot once
  }, []);

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
    const toUpload = await compressImageFile(file);
    const fd = new FormData();
    fd.set("file", toUpload);
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
      return r.json() as Promise<{ events: InstructorEventApi[] }>;
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
    setCategory(ev.category ?? "");
    setEventAt("");
    const slotList = api.slots ?? [];
    const hasSlotRows = Boolean(api.hasSlots && slotList.length > 0);
    setUseSlots(hasSlotRows || !ev.eventAt);
    if (hasSlotRows && slotList.length) {
      setSlotRows(slotRowsFromApi(slotList, todayYmd()));
    } else if (!ev.eventAt) {
      setSlotRows(defaultSlotsForToday());
    }
    setPriceRub(ev.priceRub != null && ev.priceRub > 0 ? String(ev.priceRub) : "");
    setMaxRegistrations(ev.maxRegistrations != null ? String(ev.maxRegistrations) : "");
    setPhotoUrl(ev.photoUrl ?? "");
    setPhotoFile(null);
    setTemplatePhotoSourceId(ev.photoUrl ? ev.id : null);
    setVenue(venueFromEvent(ev));
    setRepeatDaily(Boolean(ev.repeatDaily));
    setCanEdit(true);
    setLoadedStatus(null);
    queueMicrotask(() =>
      captureFormSnapshot({
        title: opts?.keepTitle !== false ? ev.title : title,
        body: ev.body,
        category: ev.category ?? "",
        eventAt: "",
        useSlots: Boolean((api.hasSlots && (api.slots?.length ?? 0) > 0) || !ev.eventAt),
        slotRows:
          api.hasSlots && api.slots?.length
            ? slotRowsFromApi(api.slots, todayYmd())
            : !ev.eventAt
              ? defaultSlotsForToday()
              : [],
        priceRub: ev.priceRub != null && ev.priceRub > 0 ? String(ev.priceRub) : "",
        maxRegistrations: ev.maxRegistrations != null ? String(ev.maxRegistrations) : "",
        venue: venueFromEvent(ev),
        repeatDaily: Boolean(ev.repeatDaily),
        photoUrl: ev.photoUrl ?? "",
        photoFileName: null,
        templatePhotoSourceId: ev.photoUrl ? ev.id : null,
      }),
    );
  }, []);

  const loadFormFromEvent = useCallback((ev: InstructorEventApi | InstructorEventDTO) => {
    const api = ev as InstructorEventApi;
    setEditingId(ev.id);
    setTitle(ev.title);
    setBody(ev.body);
    setCategory(ev.category ?? "");
    setEventAt(toDatetimeLocalValue(ev.eventAt));
    const slotList = api.slots ?? [];
    const hasSlotRows = Boolean(api.hasSlots && slotList.length > 0);
    setUseSlots(hasSlotRows || !ev.eventAt);
    const nextSlots =
      hasSlotRows && slotList.length
        ? slotRowsFromApi(slotList, api.eventDay ?? (eventDayFromEventAt(ev.eventAt) || todayYmd()))
        : !ev.eventAt
          ? defaultSlotsForToday()
          : [];
    if (hasSlotRows && slotList.length) {
      setSlotRows(nextSlots);
    } else if (!ev.eventAt) {
      setSlotRows(nextSlots);
    }
    const nextPrice = ev.priceRub != null && ev.priceRub > 0 ? String(ev.priceRub) : "";
    const nextMax = ev.maxRegistrations != null ? String(ev.maxRegistrations) : "";
    setPriceRub(nextPrice);
    setMaxRegistrations(nextMax);
    setPhotoUrl(ev.photoUrl ?? "");
    setPhotoFile(null);
    setTemplatePhotoSourceId(null);
    setVenue(venueFromEvent(ev));
    setRepeatDaily(Boolean(ev.repeatDaily));
    setCanEdit(ev.canEdit);
    setLoadedStatus(ev.moderationStatus);
    queueMicrotask(() =>
      captureFormSnapshot({
        title: ev.title,
        body: ev.body,
        category: ev.category ?? "",
        eventAt: toDatetimeLocalValue(ev.eventAt),
        useSlots: hasSlotRows || !ev.eventAt,
        slotRows: nextSlots,
        priceRub: nextPrice,
        maxRegistrations: nextMax,
        venue: venueFromEvent(ev),
        repeatDaily: Boolean(ev.repeatDaily),
        photoUrl: ev.photoUrl ?? "",
        photoFileName: null,
        templatePhotoSourceId: null,
      }),
    );
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setCategory("");
    setEventAt("");
    setUseSlots(true);
    setSlotRows(defaultSlotsForToday());
    setDraftSlotDate(todayYmd());
    setDraftSlotTime("10:00");
    setDraftSlotPrice("");
    setDraftSlotSeats("4");
    setPriceRub("");
    setMaxRegistrations("");
    setPhotoUrl("");
    setPhotoFile(null);
    setTemplatePhotoSourceId(null);
    setRepeatDaily(false);
    setVenue(EMPTY_VENUE);
    setCanEdit(true);
    setLoadedStatus(null);
    queueMicrotask(() =>
      captureFormSnapshot({
        title: "",
        body: "",
        category: "",
        eventAt: "",
        useSlots: true,
        slotRows: defaultSlotsForToday(),
        priceRub: "",
        maxRegistrations: "",
        venue: EMPTY_VENUE,
        repeatDaily: false,
        photoUrl: "",
        photoFileName: null,
        templatePhotoSourceId: null,
      }),
    );
  }, []);

  const saveDraft = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        body: body.trim(),
        category: category.trim(),
        orderId: null,
        eventId: editingId,
        repeatDaily,
      };

      if (!category.trim()) {
        throw new Error("Выберите категорию мероприятия");
      }

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
        payload.slots = slotRows
          .filter((s) => s.date.trim() && s.time.trim())
          .map((s) => {
            const maxParsed = s.maxSeats.trim() ? Number.parseInt(s.maxSeats.trim(), 10) : NaN;
            const priceParsed = s.priceRub.trim() ? Number.parseInt(s.priceRub.trim(), 10) : NaN;
            const titleTrim = s.title.trim();
            return {
              id: s.id && !s.id.startsWith("local-") ? s.id : undefined,
              date: s.date.trim(),
              time: s.time.trim(),
              title: titleTrim || null,
              maxSeats: Number.isFinite(maxParsed) && maxParsed >= 1 ? maxParsed : null,
              priceRub: Number.isFinite(priceParsed) && priceParsed >= 0 ? priceParsed : null,
            };
          });
        if (!(payload.slots as unknown[]).length) {
          throw new Error("Добавьте хотя бы один выход с датой и временем");
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
      onRequestCreateView?.();
      toast.message("Новое мероприятие по образцу — укажите дату и сохраните черновик");
    },
    [fillTemplateFromEvent, onRequestCreateView],
  );

  const handleCardEdit = useCallback(
    (ev: InstructorEventApi) => {
      if (canRestoreArchivedEvent(asEventCard(ev))) {
        restoreDraft.mutate(ev.id);
        onRequestCreateView?.();
        return;
      }
      loadFormFromEvent(ev);
      onRequestCreateView?.();
    },
    [loadFormFromEvent, onRequestCreateView, restoreDraft],
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
  const formLocked = !canEdit;
  const latestSlotDay = useSlots
    ? slotRows
        .map((s) => s.date.trim())
        .filter(Boolean)
        .sort()
        .at(-1) ?? ""
    : "";
  const effectiveEventAt =
    useSlots && latestSlotDay
      ? new Date(`${latestSlotDay}T23:59:59`)
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

  function validateEventForm(): string | null {
    if (!title.trim() || !body.trim()) return "Заполните заголовок и текст";
    if (!category.trim()) return "Выберите категорию мероприятия";
    if (useSlots && !slotRows.some((s) => s.date.trim() && s.time.trim())) {
      return "Добавьте хотя бы один выход с датой и временем";
    }
    if (!useSlots && !eventAt.trim()) return "Укажите дату и время";
    return null;
  }

  function addDraftSlot() {
    if (!draftSlotDate.trim() || !draftSlotTime.trim()) {
      toast.error("Укажите дату и время выхода");
      return;
    }
    const newRow: SlotFormRow = {
      id: newLocalSlotId(),
      date: draftSlotDate.trim(),
      time: draftSlotTime.trim(),
      title: "",
      maxSeats: draftSlotSeats.trim(),
      priceRub: draftSlotPrice.trim(),
    };
    setSlotRows((rows) =>
      [...rows, newRow].sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      ),
    );
    setDraftSlotDate(addDaysYmd(draftSlotDate.trim(), 1));
    toast.success("День добавлен в список ниже");
  }

  function buildPreviewFeedCard(): ClientEventFeedCardDTO | null {
    const err = validateEventForm();
    if (err) {
      toast.error(err);
      return null;
    }
    const photo =
      photoPreview ?? (photoUrl ? (publicUploadDisplaySrc(photoUrl) ?? photoUrl) : null);
    const validSlots = slotRows.filter((s) => s.date.trim() && s.time.trim());
    const mappedSlots = useSlots
      ? validSlots.map((s, idx) => {
          const maxParsed = s.maxSeats.trim() ? Number.parseInt(s.maxSeats.trim(), 10) : NaN;
          const priceParsed = s.priceRub.trim() ? Number.parseInt(s.priceRub.trim(), 10) : NaN;
          const priceRubVal =
            Number.isFinite(priceParsed) && priceParsed >= 0 ? priceParsed : null;
          const maxSeats =
            Number.isFinite(maxParsed) && maxParsed >= 1 ? maxParsed : null;
          return {
            id: s.id ?? `preview-slot-${idx}`,
            startsAt: slotStartsAtIso(s.date, s.time),
            title: s.title.trim() || null,
            maxSeats,
            priceRub: priceRubVal,
            sortOrder: idx,
            paidCount: 0,
            spotsLeft: maxSeats,
            isFull: false,
            isCompleted: false,
            registrationOpen: false,
            isFree: priceRubVal == null || priceRubVal <= 0,
            myRegistration: null,
          };
        })
      : [];
    const priceParsed = priceRub.trim() ? Number.parseInt(priceRub.trim(), 10) : NaN;
    const classicPrice =
      Number.isFinite(priceParsed) && priceParsed >= 0 ? priceParsed : null;
    const firstAt = useSlots
      ? mappedSlots[0]?.startsAt ?? null
      : eventAt.trim()
        ? new Date(eventAt).toISOString()
        : null;
    const event: ClientInstructorEventDTO = {
      id: editingId ?? "preview-draft",
      title: title.trim(),
      titleId: null,
      catalogItemId: null,
      body: body.trim(),
      category: category.trim() || null,
      photoUrl: photo,
      eventAt: firstAt,
      moderationStatus: "DRAFT",
      rejectNote: null,
      orderId: null,
      priceRub: useSlots ? mappedSlots[0]?.priceRub ?? null : classicPrice,
      maxRegistrations: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submittedAt: null,
      publishedAt: null,
      isCompleted: false,
      canEdit: true,
      repeatDaily,
      venueAddress: venue.address.trim() || null,
      venueLat: venue.lat,
      venueLng: venue.lng,
      instructorId: "preview",
      instructorName: "Предпросмотр",
      paidRegistrationCount: 0,
      spotsLeft: mappedSlots[0]?.spotsLeft ?? null,
      registrationOpen: false,
      isFree: useSlots
        ? Boolean(mappedSlots[0]?.isFree)
        : classicPrice == null || classicPrice <= 0,
      myRegistration: null,
      slots: mappedSlots,
      hasSlots: useSlots && mappedSlots.length > 0,
    };
    return { kind: "single", event };
  }

  async function handleSendToModeration() {
    if (formLocked) {
      toast.error("Редактирование недоступно");
      return;
    }
    const err = validateEventForm();
    if (err) {
      toast.error(err);
      return;
    }
    setSendToModerationPending(true);
    try {
      const saved = await saveDraft.mutateAsync();
      const r = await instructorFetch(`/api/instructor/events/${saved.event.id}/submit`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof j.error === "string" ? j.error : "Не удалось отправить на модерацию");
      }
      const j = (await r.json()) as { message?: string };
      resetForm();
      onRequestCreateView?.();
      toast.success(j.message ?? "Отправлено на модерацию — можно создать новое мероприятие");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить на модерацию");
    } finally {
      setSendToModerationPending(false);
    }
  }

  const groups = {
    draft: events.filter((e) => e.moderationStatus === "DRAFT"),
    pending: events.filter((e) => e.moderationStatus === "PENDING_REVIEW"),
    published: events.filter((e) => e.moderationStatus === "PUBLISHED" && !e.isCompleted),
    rejected: events.filter((e) => e.moderationStatus === "REJECTED"),
    past: events.filter((e) => e.isCompleted),
    archived: events.filter((e) => e.moderationStatus === "ARCHIVED" && !e.isCompleted),
  };

  const showCreate = view === "all" || view === "create";
  const showList = view === "all" || view === "list";
  const showSaved = view === "saved";
  const showPast = view === "past";

  const leaveApiRef = useRef<EventCreateLeaveGuard>({
    shouldConfirmLeave: () => false,
    save: async () => false,
    discard: () => undefined,
  });
  leaveApiRef.current = {
    shouldConfirmLeave: () => {
      if (formLocked) return false;
      if (loadedStatus === "PENDING_REVIEW" || loadedStatus === "PUBLISHED") return false;
      if (!formHasContent()) return false;
      return isFormDirtyNow() || !editingId || loadedStatus === "DRAFT" || loadedStatus === null;
    },
    save: async () => {
      const err = validateEventForm();
      if (err) {
        toast.error(err);
        return false;
      }
      try {
        await saveDraft.mutateAsync();
        return true;
      } catch {
        return false;
      }
    },
    discard: () => {
      resetForm();
    },
  };

  useEffect(() => {
    if (!onLeaveGuardReady) return;
    if (!showCreate) {
      onLeaveGuardReady(null);
      return;
    }
    onLeaveGuardReady({
      shouldConfirmLeave: () => leaveApiRef.current.shouldConfirmLeave(),
      save: () => leaveApiRef.current.save(),
      discard: () => leaveApiRef.current.discard(),
    });
    return () => onLeaveGuardReady(null);
  }, [onLeaveGuardReady, showCreate]);

  const listActionsPending =
    restoreDraft.isPending ||
    submitModeration.isPending ||
    remove.isPending ||
    cancelEvent.isPending;

  const editorContent = (
    <div className={embedded ? "space-y-6" : undefined}>
      <CardContent className={embedded ? "p-0 space-y-6" : "space-y-6"}>
        {showCreate ? (
          <>
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
            if (useSlots && !slotRows.some((s) => s.date.trim() && s.time.trim())) {
              toast.error("Добавьте хотя бы один выход с датой и временем");
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название мероприятия"
              maxLength={120}
              disabled={formLocked}
              required
            />
            <CatalogSoftDupeHint title={title} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-category">Категория</Label>
            <select
              id="event-category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={formLocked}
              required
            >
              <option value="">Выберите категорию</option>
              {eventCategoryOptions().map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
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
                maxLength={1000}
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
                Многодневный тур
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="event-format"
                  checked={!useSlots}
                  disabled={formLocked}
                  onChange={() => setUseSlots(false)}
                />
                Однодневный выход
              </label>
            </div>

            {!useSlots ? (
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
            ) : null}

            {useSlots ? (
              <div className="space-y-3">
                {!formLocked ? (
                  <div className="space-y-2 rounded-md border border-dashed border-border/80 bg-muted/20 p-3">
                    <Label>Добавить день выхода</Label>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label htmlFor="draft-slot-date" className="text-xs text-muted-foreground">
                          Дата
                        </Label>
                        <Input
                          id="draft-slot-date"
                          type="date"
                          value={draftSlotDate}
                          onChange={(e) => setDraftSlotDate(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="draft-slot-time" className="text-xs text-muted-foreground">
                          Время
                        </Label>
                        <Input
                          id="draft-slot-time"
                          type="time"
                          value={draftSlotTime}
                          onChange={(e) => setDraftSlotTime(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="draft-slot-price" className="text-xs text-muted-foreground">
                          Цена, ₽
                        </Label>
                        <Input
                          id="draft-slot-price"
                          type="number"
                          min={0}
                          max={500000}
                          placeholder="0"
                          value={draftSlotPrice}
                          onChange={(e) => setDraftSlotPrice(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="draft-slot-seats" className="text-xs text-muted-foreground">
                          Мест
                        </Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id="draft-slot-seats"
                            type="number"
                            min={1}
                            max={10000}
                            placeholder="∞"
                            value={draftSlotSeats}
                            onChange={(e) => setDraftSlotSeats(e.target.value)}
                            className="h-9"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="accent"
                            className="h-9 w-full shrink-0 sm:w-auto"
                            onClick={addDraftSlot}
                          >
                            + Добавить
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>
                    Дни мероприятия
                    {slotRows.length > 0 ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({slotRows.length})
                      </span>
                    ) : null}
                  </Label>

                  {slotRows.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      Пока нет дней — заполните поля выше и нажмите «+ Добавить»
                    </p>
                  ) : (
                    <ul className="space-y-2 md:hidden">
                      {slotRows.map((row, idx) => (
                        <li
                          key={row.id ?? `mobile-${idx}`}
                          className="rounded-md border border-border bg-background p-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">
                                {row.date ? formatYmdRu(row.date) : "—"} · {row.time || "—"}
                              </p>
                              <p className="text-muted-foreground">
                                {row.priceRub.trim()
                                  ? `${row.priceRub} ₽`
                                  : "бесплатно"}
                                {" · "}
                                {row.maxSeats.trim() ? `${row.maxSeats} мест` : "без лимита"}
                              </p>
                            </div>
                            {!formLocked ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 shrink-0 text-destructive"
                                onClick={() =>
                                  setSlotRows((rows) => rows.filter((_, i) => i !== idx))
                                }
                              >
                                Удалить
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="hidden overflow-x-auto rounded-md border border-border md:block">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Дата</th>
                          <th className="px-2 py-2 font-medium">Время</th>
                          <th className="px-2 py-2 font-medium">Мест</th>
                          <th className="px-2 py-2 font-medium">Цена, ₽</th>
                          {!formLocked ? <th className="px-2 py-2 w-10" /> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {slotRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={formLocked ? 4 : 5}
                              className="px-3 py-4 text-center text-xs text-muted-foreground"
                            >
                              Пока нет дней — заполните поля выше и нажмите «+ Добавить»
                            </td>
                          </tr>
                        ) : (
                          slotRows.map((row, idx) => (
                            <tr
                              key={row.id ?? `new-${idx}`}
                              className="border-b border-border/60 last:border-0"
                            >
                              <td className="px-2 py-1.5">
                                <Input
                                  type="date"
                                  value={row.date}
                                  disabled={formLocked}
                                  onChange={(e) =>
                                    setSlotRows((rows) =>
                                      rows.map((r, i) =>
                                        i === idx ? { ...r, date: e.target.value } : r,
                                      ),
                                    )
                                  }
                                  className="h-9"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="time"
                                  value={row.time}
                                  disabled={formLocked}
                                  onChange={(e) =>
                                    setSlotRows((rows) =>
                                      rows.map((r, i) =>
                                        i === idx ? { ...r, time: e.target.value } : r,
                                      ),
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
                                      rows.map((r, i) =>
                                        i === idx ? { ...r, maxSeats: e.target.value } : r,
                                      ),
                                    )
                                  }
                                  className="h-9 w-24"
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
                                      rows.map((r, i) =>
                                        i === idx ? { ...r, priceRub: e.target.value } : r,
                                      ),
                                    )
                                  }
                                  className="h-9 w-28"
                                />
                              </td>
                              {!formLocked ? (
                                <td className="px-2 py-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-destructive"
                                    onClick={() =>
                                      setSlotRows((rows) => rows.filter((_, i) => i !== idx))
                                    }
                                  >
                                    ×
                                  </Button>
                                </td>
                              ) : null}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Каждый день — отдельная строка с датой, временем, названием и ценой. Клиент
                    записывается именно на выбранный день.
                  </p>
                </div>
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={saveDraft.isPending || sendToModerationPending}
                  onClick={() => {
                    const card = buildPreviewFeedCard();
                    if (!card) return;
                    setPreviewCard(card);
                    setPreviewOpen(true);
                  }}
                >
                  Посмотреть
                </Button>
                <Button type="submit" variant="outline" disabled={saveDraft.isPending || sendToModerationPending}>
                  {saveDraft.isPending ? "Сохранение…" : "Сохранить черновик"}
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  disabled={saveDraft.isPending || sendToModerationPending || submitModeration.isPending}
                  onClick={() => void handleSendToModeration()}
                >
                  {sendToModerationPending ? "Отправка…" : "Отправить на модерацию"}
                </Button>
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

        {previewOpen && previewCard ? (
          <EventViewerOverlay
            cards={[previewCard]}
            index={0}
            onIndexChange={() => undefined}
            onClose={() => {
              setPreviewOpen(false);
              setPreviewCard(null);
            }}
            queryKey={["instructor-event-preview"]}
            showDistance={false}
            isClient={false}
          />
        ) : null}

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
          </>
        ) : null}

        {showSaved ? (
          <>
            {isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
            <EventList
              title="Сохранённые мероприятия"
              events={groups.draft}
              isLoading={isLoading}
              emptyMessage="Пока нет сохранённых мероприятий. Сохраните черновик на странице создания."
              onEdit={handleCardEdit}
              onDuplicate={handleDuplicate}
              onSubmitModeration={(id) => submitModeration.mutate(id)}
              submitModerationPending={submitModeration.isPending}
              onDelete={handleCardDelete}
              onCancelEvent={handleCancelEvent}
              actionsPending={listActionsPending}
              hint="Черновики до отправки на проверку. Можно править или отправить на модерацию."
            />
          </>
        ) : null}

        {showPast ? (
          <>
            {isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
            <EventList
              title="Прошедшие мероприятия"
              events={groups.past}
              isLoading={isLoading}
              emptyMessage="Пока нет прошедших мероприятий."
              onDelete={handleCardDelete}
              actionsPending={remove.isPending}
              hint="Дата и время уже прошли — с ленты клиентов сняты автоматически."
            />
          </>
        ) : null}

        {showList ? (
          <>
            {!isLoading &&
            !groups.pending.length &&
            !groups.published.length &&
            !groups.rejected.length &&
            !groups.archived.length ? (
              <p className="text-sm text-muted-foreground">Пока нет активных мероприятий.</p>
            ) : null}
            {isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
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
            actionsPending={listActionsPending}
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
            actionsPending={listActionsPending}
            hint="Не в ленте и не на карте. «Редактировать» / «Восстановить черновик» — правки; «Восстановить и на модерацию» — сразу на проверку."
          />
        ) : null}
          </>
        ) : null}
      </CardContent>
    </div>
  );

  if (embedded) {
    return <div className="space-y-4">{editorContent}</div>;
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
  emptyMessage,
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
  emptyMessage?: string;
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
  if (!events.length) {
    if (!emptyMessage) return null;
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

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
              {ev.category ? (
                <Badge variant="secondary" className="text-[10px]">
                  {ev.category}
                </Badge>
              ) : null}
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
