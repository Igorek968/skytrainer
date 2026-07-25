"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminEventEditorSheet } from "@/features/admin/admin-event-editor-sheet";
import {
  EventCatalogNavShell,
  type CatalogNavPanelDef,
} from "@/features/events/event-catalog-nav-shell";
import { EventVenuePicker, type EventVenueValue } from "@/features/instructor/event-venue-picker";
import { catalogStatusLabel, type EventCatalogItemDTO } from "@/lib/event-catalog";
import { eventCategoryOptions } from "@/lib/event-category";
import {
  FALLBACK_MAP_CITY,
  getMapCityBySlug,
  resolveCitySlugForPlace,
  type MapCityCenter,
} from "@/lib/map-city-centers";
import type { EventCatalogStatus } from "@prisma/client";
import type { InstructorEventDTO } from "@/lib/instructor-events";
import { formatEventDateRu, moderationStatusLabel } from "@/lib/instructor-events";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { compressImageFile } from "@/lib/compress-image-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type PublishedEvent = InstructorEventDTO & {
  instructor: { id: string; name: string | null; email: string };
  catalogItem?: { id: string; title: string; status: string; citySlug?: string | null } | null;
};

const CITY_STORAGE_KEY = "skiinstruct_admin_catalog_city";

type CatalogPanel = "create" | "cards" | "published";

const PANEL_LABELS: Record<CatalogPanel, string> = {
  create: "Создать карточку",
  cards: "Карточки каталога",
  published: "Опубликованные",
};

const ADMIN_PANELS: readonly CatalogNavPanelDef<CatalogPanel>[] = [
  { id: "create", label: PANEL_LABELS.create, variant: "secondary" },
  { id: "cards", label: PANEL_LABELS.cards, variant: "outline" },
  { id: "published", label: PANEL_LABELS.published, variant: "outline" },
];

function venueForCity(city: MapCityCenter): EventVenueValue {
  return { address: "", lat: city.lat, lng: city.lng };
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

async function readJson(r: Response): Promise<unknown> {
  const raw = await r.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function uploadCatalogPhoto(catalogId: string, file: File) {
  const toUpload = await compressImageFile(file);
  const fd = new FormData();
  fd.set("file", toUpload);
  const r = await fetch(`/api/admin/event-catalog/${catalogId}/photo`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const payload = await readJson(r);
  if (!r.ok) throw new Error(parseApiError(payload, "Не удалось загрузить фото"));
  return payload as { photoUrl?: string; message?: string };
}

function readStoredCitySlug(): string {
  try {
    const stored = localStorage.getItem(CITY_STORAGE_KEY);
    if (stored && getMapCityBySlug(stored)) return stored;
  } catch {
    /* ignore */
  }
  return FALLBACK_MAP_CITY.slug;
}

export function AdminEventCatalogSection() {
  const qc = useQueryClient();
  const [citySlug, setCitySlug] = useState(FALLBACK_MAP_CITY.slug);
  const [cityReady, setCityReady] = useState(false);
  const [venue, setVenue] = useState<EventVenueValue>(() => venueForCity(FALLBACK_MAP_CITY));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [eventAtLocal, setEventAtLocal] = useState("");
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [attachForId, setAttachForId] = useState<string | null>(null);
  const [attachIds, setAttachIds] = useState<string[]>([]);
  const [offersForId, setOffersForId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<EventCatalogItemDTO | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editEventAtLocal, setEditEventAtLocal] = useState("");
  const [editVenue, setEditVenue] = useState<EventVenueValue>({ address: "", lat: null, lng: null });
  const [activePanel, setActivePanel] = useState<CatalogPanel | null>(null);
  const [editEventId, setEditEventId] = useState<string | null>(null);

  useEffect(() => {
    const slug = readStoredCitySlug();
    const city = getMapCityBySlug(slug) ?? FALLBACK_MAP_CITY;
    setCitySlug(city.slug);
    setVenue(venueForCity(city));
    setCityReady(true);
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

  const selectedCity = getMapCityBySlug(citySlug) ?? FALLBACK_MAP_CITY;

  function changeCity(nextSlug: string) {
    const city = getMapCityBySlug(nextSlug);
    if (!city) return;
    setCitySlug(city.slug);
    try {
      localStorage.setItem(CITY_STORAGE_KEY, city.slug);
    } catch {
      /* ignore */
    }
    setVenue(venueForCity(city));
    setSelectedEventIds([]);
    setAttachForId(null);
    setAttachIds([]);
    setActivePanel(null);
  }

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ["admin-event-catalog"],
    queryFn: async () => {
      const r = await fetch("/api/admin/event-catalog", { credentials: "include" });
      if (!r.ok) throw new Error("catalog");
      return r.json() as Promise<{ items: EventCatalogItemDTO[] }>;
    },
    refetchInterval: 30_000,
  });

  const { data: publishedData, isLoading: publishedLoading } = useQuery({
    queryKey: ["admin-published-events"],
    queryFn: async () => {
      const r = await fetch("/api/admin/events?status=PUBLISHED", { credentials: "include" });
      if (!r.ok) throw new Error("events");
      return r.json() as Promise<{ events: PublishedEvent[] }>;
    },
    refetchInterval: 30_000,
  });

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-event-catalog"] });
    await qc.invalidateQueries({ queryKey: ["admin-published-events"] });
    await qc.invalidateQueries({ queryKey: ["admin-pending-events"] });
    await qc.invalidateQueries({ queryKey: ["client-events"] });
  };

  const resetCreateForm = () => {
    setVenue(venueForCity(selectedCity));
    setPhotoFile(null);
    setTitle("");
    setBody("");
    setCategory("");
    setEventAtLocal("");
    setSelectedEventIds([]);
  };

  const createCatalog = useMutation({
    mutationFn: async (publish: boolean) => {
      const venueAddress = venue.address.trim();
      if (venueAddress && (venue.lat == null || venue.lng == null)) {
        throw new Error("Поставьте точку на карте или найдите адрес кнопкой «Найти»");
      }
      const eventAt = eventAtLocal ? new Date(eventAtLocal).toISOString() : null;
      const r = await fetch("/api/admin/event-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          category: category.trim(),
          eventAt,
          venueAddress: venueAddress || null,
          venueLat: venue.lat ?? selectedCity.lat,
          venueLng: venue.lng ?? selectedCity.lng,
          citySlug: selectedCity.slug,
          eventIds: selectedEventIds,
          publish,
        }),
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось создать карточку"));
      const created = payload as { item?: { id: string }; message?: string };
      if (photoFile && created.item?.id) {
        await uploadCatalogPhoto(created.item.id, photoFile);
      }
      return created;
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? "Карточка создана");
      resetCreateForm();
      await invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusAction = useMutation({
    mutationFn: async (params: { id: string; action: "publish" | "unpublish" | "archive" }) => {
      const r = await fetch(`/api/admin/event-catalog/${params.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: params.action }),
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось изменить статус"));
      return payload as { message?: string };
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? "Статус обновлён");
      await invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attachEvents = useMutation({
    mutationFn: async (params: { catalogId: string; eventIds: string[] }) => {
      const r = await fetch(`/api/admin/event-catalog/${params.catalogId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventIds: params.eventIds }),
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось привязать"));
      return payload as { message?: string };
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? "Привязано");
      setAttachForId(null);
      setAttachIds([]);
      await invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const detachEvents = useMutation({
    mutationFn: async (params: { catalogId: string; eventIds: string[] }) => {
      const r = await fetch(`/api/admin/event-catalog/${params.catalogId}/events`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventIds: params.eventIds }),
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось отвязать"));
      return payload as { message?: string };
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? "Отвязано");
      await invalidateAll();
      await qc.invalidateQueries({ queryKey: ["admin-catalog-offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ["admin-catalog-offers", offersForId],
    enabled: Boolean(offersForId),
    queryFn: async () => {
      const r = await fetch(`/api/admin/event-catalog/${offersForId}`, { credentials: "include" });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось загрузить офферы"));
      return payload as {
        events: Array<{
          id: string;
          title: string;
          body: string;
          moderationStatus: string;
          priceRub: number | null;
          eventAt: string | null;
          instructor: { name: string | null; email: string };
        }>;
      };
    },
  });

  const unpublishEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const r = await fetch(`/api/admin/events/${eventId}/unpublish`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось снять"));
      return payload as { message?: string };
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? "Снято с публикации");
      await invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (params: { catalogId: string; file: File }) =>
      uploadCatalogPhoto(params.catalogId, params.file),
    onSuccess: async (result) => {
      toast.success(result.message ?? "Фото сохранено");
      await invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCatalog = useMutation({
    mutationFn: async (catalogId: string) => {
      const r = await fetch(`/api/admin/event-catalog/${catalogId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось удалить"));
      return payload as { message?: string };
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? "Карточка удалена");
      setAttachForId(null);
      setOffersForId(null);
      setEditItem(null);
      await invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCatalog = useMutation({
    mutationFn: async () => {
      if (!editItem) throw new Error("Нет карточки");
      if (!editTitle.trim() || !editBody.trim() || !editCategory.trim()) {
        throw new Error("Заполните название, описание и категорию");
      }
      const venueAddress = editVenue.address.trim();
      if (venueAddress && (editVenue.lat == null || editVenue.lng == null)) {
        throw new Error("Для адреса укажите точку на карте");
      }
      const r = await fetch(`/api/admin/event-catalog/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: editTitle.trim(),
          body: editBody.trim(),
          category: editCategory.trim(),
          eventAt: editEventAtLocal ? new Date(editEventAtLocal).toISOString() : null,
          venueAddress: venueAddress || null,
          venueLat: editVenue.lat,
          venueLng: editVenue.lng,
          citySlug,
        }),
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось сохранить"));
      return payload;
    },
    onSuccess: async () => {
      toast.success("Карточка обновлена");
      setEditItem(null);
      await invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(item: EventCatalogItemDTO) {
    setEditItem(item);
    setEditTitle(item.title);
    setEditBody(item.body);
    setEditCategory(item.category ?? "");
    if (item.eventAt) {
      const d = new Date(item.eventAt);
      if (Number.isFinite(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        setEditEventAtLocal(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
        );
      } else setEditEventAtLocal("");
    } else setEditEventAtLocal("");
    setEditVenue({
      address: item.venueAddress ?? "",
      lat: item.venueLat ?? null,
      lng: item.venueLng ?? null,
    });
  }

  const createFromEvent = useMutation({
    mutationFn: async (ev: PublishedEvent) => {
      if (!ev.category?.trim()) {
        throw new Error(
          "У мероприятия нет категории. Создайте карточку вручную и выберите категорию, либо попросите инструктора указать её.",
        );
      }
      const r = await fetch("/api/admin/event-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: ev.title,
          body: ev.body,
          category: ev.category.trim(),
          photoUrl: ev.photoUrl,
          eventAt: ev.eventAt,
          venueAddress: ev.venueAddress ?? null,
          venueLat: ev.venueLat ?? selectedCity.lat,
          venueLng: ev.venueLng ?? selectedCity.lng,
          citySlug: selectedCity.slug,
          eventIds: [ev.id],
          publish: true,
        }),
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось создать карточку"));
      return payload as { message?: string };
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? "Карточка каталога создана и опубликована");
      await invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itemsInCity = useMemo(() => {
    const all = catalogData?.items ?? [];
    return all.filter((item) => {
      const slug = resolveCitySlugForPlace({
        citySlug: item.citySlug,
        lat: item.venueLat,
        lng: item.venueLng,
        address: item.venueAddress,
      });
      return slug === citySlug;
    });
  }, [catalogData?.items, citySlug]);

  const publishedInCity = useMemo(() => {
    const all = publishedData?.events ?? [];
    return all.filter((ev) => {
      const slug = resolveCitySlugForPlace({
        citySlug: ev.catalogItem?.citySlug,
        lat: ev.venueLat,
        lng: ev.venueLng,
        address: ev.venueAddress,
      });
      return slug === citySlug;
    });
  }, [publishedData?.events, citySlug]);

  const unattachedPublished = useMemo(
    () => publishedInCity.filter((ev) => !ev.catalogItemId),
    [publishedInCity],
  );

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  if (!cityReady) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return (
    <>
      {editEventId ? (
        <AdminEventEditorSheet eventId={editEventId} onClose={() => setEditEventId(null)} />
      ) : null}
    <EventCatalogNavShell
      citySlug={citySlug}
      cityName={selectedCity.name}
      citySelectId="catalog-city"
      onCityChange={changeCity}
      panels={ADMIN_PANELS}
      activePanel={activePanel}
      onActivePanelChange={setActivePanel}
      panelLabels={PANEL_LABELS}
    >
      {activePanel === "create" ? (
              <>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Новая карточка · {selectedCity.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Одно событие в ленте — несколько инструкторов. Место на карте и фото, затем
                    название.
                  </p>
                </div>

                <EventVenuePicker key={citySlug} value={venue} onChange={setVenue} mapFirst />

                <div className="space-y-2">
                  <Label htmlFor="catalog-photo">Фото мероприятия</Label>
                  <Input
                    id="catalog-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Превью"
                      className="mt-2 max-h-48 w-full rounded-md border border-border object-cover"
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">JPG, PNG или WEBP, до 5 МБ.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="catalog-title">Название</Label>
                    <Input
                      id="catalog-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={120}
                      placeholder="Дайвинг"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="catalog-category">Категория</Label>
                    <select
                      id="catalog-category"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">Выберите категорию</option>
                      {eventCategoryOptions().map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="catalog-body">Описание</Label>
                    <textarea
                      id="catalog-body"
                      className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      maxLength={2000}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="catalog-at">Дата / время</Label>
                    <Input
                      id="catalog-at"
                      type="datetime-local"
                      value={eventAtLocal}
                      onChange={(e) => setEventAtLocal(e.target.value)}
                    />
                  </div>
                </div>

                {unattachedPublished.length ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Привязать при создании (в {selectedCity.name})
                    </p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
                      {unattachedPublished.map((ev) => (
                        <li key={ev.id}>
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedEventIds.includes(ev.id)}
                              onChange={() =>
                                setSelectedEventIds((prev) => toggleId(prev, ev.id))
                              }
                            />
                            <span>
                              <span className="font-medium">{ev.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {ev.instructor.name ?? ev.instructor.email}
                                {ev.eventAt ? ` · ${formatEventDateRu(ev.eventAt)}` : null}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="accent"
                    disabled={
                      createCatalog.isPending || !title.trim() || !body.trim() || !category.trim()
                    }
                    onClick={() => createCatalog.mutate(true)}
                  >
                    Создать и опубликовать
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      createCatalog.isPending || !title.trim() || !body.trim() || !category.trim()
                    }
                    onClick={() => createCatalog.mutate(false)}
                  >
                    Черновик
                  </Button>
                </div>
              </>
            ) : null}

            {activePanel === "cards" ? (
              <>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Карточки каталога · {selectedCity.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {itemsInCity.length
                      ? `Показано ${itemsInCity.length} в этом городе.`
                      : "В этом городе пока нет карточек."}
                  </p>
                </div>
                {catalogLoading ? (
                  <p className="text-sm text-muted-foreground">Загрузка…</p>
                ) : !itemsInCity.length ? (
                  <p className="text-sm text-muted-foreground">
                    Нет карточек для «{selectedCity.name}». Создайте карточку или переключите город.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {itemsInCity.map((item) => {
                      const thumb = publicUploadDisplaySrc(item.photoUrl);
                      return (
                        <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex gap-3">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
                                alt=""
                                className="h-16 w-16 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                                🎿
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <div className="font-medium">{item.title}</div>
                                <span className="text-xs text-muted-foreground">
                                  {catalogStatusLabel(item.status)} · офферов: {item.offerCount}
                                </span>
                              </div>
                              {item.category ? (
                                <p className="text-xs text-muted-foreground">{item.category}</p>
                              ) : null}
                              {item.eventAt ? (
                                <p className="text-xs text-muted-foreground">
                                  {formatEventDateRu(item.eventAt)}
                                </p>
                              ) : null}
                              {item.venueAddress ? (
                                <p className="text-xs text-muted-foreground">{item.venueAddress}</p>
                              ) : null}
                              <p className="mt-1 line-clamp-2 text-muted-foreground">{item.body}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.status !== "PUBLISHED" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="accent"
                                disabled={statusAction.isPending}
                                onClick={() =>
                                  statusAction.mutate({ id: item.id, action: "publish" })
                                }
                              >
                                Опубликовать
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={statusAction.isPending}
                                onClick={() =>
                                  statusAction.mutate({ id: item.id, action: "unpublish" })
                                }
                              >
                                Снять с публикации
                              </Button>
                            )}
                            {item.status !== "ARCHIVED" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={statusAction.isPending}
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Отправить карточку в архив? Она исчезнет из каталога инструкторов.",
                                    )
                                  ) {
                                    statusAction.mutate({ id: item.id, action: "archive" });
                                  }
                                }}
                              >
                                В архив
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => openEdit(item)}
                            >
                              Редактировать
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setAttachForId(item.id);
                                setAttachIds([]);
                              }}
                            >
                              Привязать…
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setOffersForId((prev) => (prev === item.id ? null : item.id))
                              }
                            >
                              {offersForId === item.id ? "Скрыть офферы" : "Офферы…"}
                            </Button>
                            <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground">
                              {item.photoUrl ? "Заменить фото" : "Добавить фото"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (file) uploadPhoto.mutate({ catalogId: item.id, file });
                                }}
                              />
                            </label>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={deleteCatalog.isPending}
                              onClick={() => {
                                const offerHint =
                                  item.offerCount > 0
                                    ? `\nОфферы инструкторов (${item.offerCount}) отвяжутся и останутся как отдельные мероприятия.`
                                    : "";
                                if (
                                  confirm(
                                    `Удалить карточку «${item.title}» безвозвратно?${offerHint}\n\nЭто не архив — восстановить нельзя.`,
                                  )
                                ) {
                                  deleteCatalog.mutate(item.id);
                                }
                              }}
                            >
                              Удалить
                            </Button>
                          </div>
                          {editItem?.id === item.id ? (
                            <div className="mt-3 space-y-3 rounded-md border border-accent/40 bg-accent/5 p-3">
                              <p className="text-sm font-medium">Редактирование карточки</p>
                              <EventVenuePicker value={editVenue} onChange={setEditVenue} mapFirst />
                              <div className="space-y-1.5">
                                <Label>Название</Label>
                                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Категория</Label>
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                  value={editCategory}
                                  onChange={(e) => setEditCategory(e.target.value)}
                                >
                                  <option value="">Выберите категорию</option>
                                  {eventCategoryOptions().map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Описание</Label>
                                <textarea
                                  className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Дата / время</Label>
                                <Input
                                  type="datetime-local"
                                  value={editEventAtLocal}
                                  onChange={(e) => setEditEventAtLocal(e.target.value)}
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="accent"
                                  disabled={updateCatalog.isPending}
                                  onClick={() => updateCatalog.mutate()}
                                >
                                  Сохранить
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditItem(null)}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : null}
                          {offersForId === item.id ? (
                            <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-2">
                              <p className="text-xs text-muted-foreground">
                                Заявки и привязанные мероприятия инструкторов.
                              </p>
                              {offersLoading ? (
                                <p className="text-sm text-muted-foreground">Загрузка…</p>
                              ) : !(offersData?.events?.length) ? (
                                <p className="text-sm text-muted-foreground">Пока нет офферов.</p>
                              ) : (
                                <ul className="space-y-2 text-sm">
                                  {offersData.events.map((ev) => (
                                    <li
                                      key={ev.id}
                                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5"
                                    >
                                      <div>
                                        <span className="font-medium">
                                          {ev.instructor.name ?? ev.instructor.email}
                                        </span>
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          {moderationStatusLabel(
                                            ev.moderationStatus as InstructorEventDTO["moderationStatus"],
                                          )}
                                          {ev.priceRub != null ? ` · ${ev.priceRub} ₽` : null}
                                        </span>
                                        {ev.body ? (
                                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                            {ev.body}
                                          </p>
                                        ) : null}
                                      </div>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={detachEvents.isPending}
                                        onClick={() =>
                                          detachEvents.mutate({
                                            catalogId: item.id,
                                            eventIds: [ev.id],
                                          })
                                        }
                                      >
                                        Отвязать
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : null}
                          {attachForId === item.id ? (
                            <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-2">
                              <p className="text-xs text-muted-foreground">
                                Опубликованные без карточки в «{selectedCity.name}».
                              </p>
                              <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
                                {unattachedPublished.map((ev) => (
                                  <li key={ev.id}>
                                    <label className="flex cursor-pointer items-start gap-2">
                                      <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={attachIds.includes(ev.id)}
                                        onChange={() =>
                                          setAttachIds((prev) => toggleId(prev, ev.id))
                                        }
                                      />
                                      <span>
                                        {ev.title}
                                        <span className="block text-xs text-muted-foreground">
                                          {ev.instructor.name ?? ev.instructor.email}
                                        </span>
                                      </span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={!attachIds.length || attachEvents.isPending}
                                  onClick={() =>
                                    attachEvents.mutate({
                                      catalogId: item.id,
                                      eventIds: attachIds,
                                    })
                                  }
                                >
                                  Привязать
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setAttachForId(null)}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : null}

            {activePanel === "published" ? (
              <>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Опубликованные мероприятия · {selectedCity.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {publishedInCity.length
                      ? `Показано ${publishedInCity.length} в этом городе.`
                      : "В этом городе нет опубликованных мероприятий."}
                  </p>
                </div>
                {publishedLoading ? (
                  <p className="text-sm text-muted-foreground">Загрузка…</p>
                ) : !publishedInCity.length ? (
                  <p className="text-sm text-muted-foreground">
                    Нет опубликованных мероприятий для «{selectedCity.name}».
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {publishedInCity.map((ev) => (
                      <li key={ev.id} className="rounded-lg border border-border p-3 text-sm">
                        <div className="font-medium">{ev.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {ev.instructor.name ?? ev.instructor.email} ·{" "}
                          {moderationStatusLabel(ev.moderationStatus)}
                          {ev.eventAt ? ` · ${formatEventDateRu(ev.eventAt)}` : null}
                          {ev.catalogItem
                            ? ` · каталог: ${ev.catalogItem.title} (${catalogStatusLabel(ev.catalogItem.status as EventCatalogStatus)})`
                            : " · без каталога"}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditEventId(ev.id)}
                          >
                            Редактировать
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={unpublishEvent.isPending}
                            onClick={() => {
                              if (confirm("Скрыть мероприятие из ленты клиентов?")) {
                                unpublishEvent.mutate(ev.id);
                              }
                            }}
                          >
                            Снять с публикации
                          </Button>
                          {!ev.catalogItemId ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={createFromEvent.isPending}
                              onClick={() => createFromEvent.mutate(ev)}
                            >
                              Создать карточку каталога
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
    </EventCatalogNavShell>
    </>
  );
}
