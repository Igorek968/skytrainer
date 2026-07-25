"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  FALLBACK_MAP_CITY,
  MAP_CITY_CENTERS,
  getMapCityBySlug,
} from "@/lib/map-city-centers";
import type { InstructorCatalogBrowseItemDTO } from "@/lib/event-catalog";
import {
  catalogStatusLabel,
  type EventCatalogItemDTO,
} from "@/lib/event-catalog";
import {
  formatEventDateRu,
  formatEventPriceRu,
  moderationStatusLabel,
  toDatetimeLocalValue,
} from "@/lib/instructor-events";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const CITY_STORAGE_KEY = "skiinstruct_instructor_catalog_city";

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

function readStoredCitySlug(): string {
  try {
    const stored = localStorage.getItem(CITY_STORAGE_KEY);
    if (stored && getMapCityBySlug(stored)) return stored;
  } catch {
    /* ignore */
  }
  return FALLBACK_MAP_CITY.slug;
}

type JoinFormState = {
  serviceNote: string;
  priceRub: string;
  maxRegistrations: string;
  eventAtLocal: string;
};

function emptyJoinForm(item?: Pick<EventCatalogItemDTO, "eventAt" | "body">): JoinFormState {
  return {
    serviceNote: "",
    priceRub: "",
    maxRegistrations: "",
    eventAtLocal: item?.eventAt ? toDatetimeLocalValue(item.eventAt) : "",
  };
}

export function InstructorCatalogJoinPanel({
  embedded = false,
  citySlug: citySlugProp,
  onCityChange: onCityChangeProp,
  hideCityPicker = false,
}: {
  /** Без внешней Card — внутри общего каркаса каталога. */
  embedded?: boolean;
  /** Город снаружи (общий селектор с админским UI). */
  citySlug?: string;
  onCityChange?: (slug: string) => void;
  hideCityPicker?: boolean;
} = {}) {
  const qc = useQueryClient();
  const [citySlugInternal, setCitySlugInternal] = useState(FALLBACK_MAP_CITY.slug);
  const [cityReady, setCityReady] = useState(Boolean(citySlugProp));
  const [q, setQ] = useState("");
  const [joinForId, setJoinForId] = useState<string | null>(null);
  const [form, setForm] = useState<JoinFormState>(() => emptyJoinForm());

  const cityControlled = citySlugProp != null;
  const citySlug = cityControlled ? citySlugProp : citySlugInternal;

  useEffect(() => {
    if (cityControlled) {
      setCityReady(true);
      return;
    }
    setCitySlugInternal(readStoredCitySlug());
    setCityReady(true);
  }, [cityControlled]);

  const selectedCity = getMapCityBySlug(citySlug) ?? FALLBACK_MAP_CITY;

  function changeCity(nextSlug: string) {
    const city = getMapCityBySlug(nextSlug);
    if (!city) return;
    if (onCityChangeProp) {
      onCityChangeProp(city.slug);
    } else {
      setCitySlugInternal(city.slug);
      try {
        localStorage.setItem(CITY_STORAGE_KEY, city.slug);
      } catch {
        /* ignore */
      }
    }
    setJoinForId(null);
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["instructor-event-catalog", citySlug, q],
    enabled: cityReady,
    queryFn: async () => {
      const params = new URLSearchParams({ citySlug });
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/instructor/event-catalog?${params}`, {
        credentials: "include",
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось загрузить каталог"));
      return payload as { items: InstructorCatalogBrowseItemDTO[] };
    },
    refetchInterval: 30_000,
  });

  const items = data?.items ?? [];

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["instructor-event-catalog"] });
    await qc.invalidateQueries({ queryKey: ["instructor-events"] });
    await qc.invalidateQueries({ queryKey: ["instructor-week-schedule"] });
    await qc.invalidateQueries({ queryKey: ["client-events"] });
  };

  const join = useMutation({
    mutationFn: async (catalogId: string) => {
      const priceRaw = form.priceRub.trim();
      const seatsRaw = form.maxRegistrations.trim();
      const priceRub = priceRaw === "" ? null : Number(priceRaw);
      const maxRegistrations = seatsRaw === "" ? null : Number(seatsRaw);
      if (priceRaw !== "" && (!Number.isFinite(priceRub) || (priceRub ?? 0) < 0)) {
        throw new Error("Некорректная цена");
      }
      if (seatsRaw !== "" && (!Number.isFinite(maxRegistrations) || (maxRegistrations ?? 0) < 1)) {
        throw new Error("Некорректный лимит мест");
      }
      const r = await fetch(`/api/instructor/event-catalog/${catalogId}/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceNote: form.serviceNote.trim(),
          priceRub,
          maxRegistrations,
          eventAt: form.eventAtLocal ? new Date(form.eventAtLocal).toISOString() : null,
        }),
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось отправить заявку"));
      return payload as { message?: string };
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? "Заявка отправлена");
      setJoinForId(null);
      setForm(emptyJoinForm());
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async (catalogId: string) => {
      const r = await fetch(`/api/instructor/event-catalog/${catalogId}/offer`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await readJson(r);
      if (!r.ok) throw new Error(parseApiError(payload, "Не удалось отозвать"));
      return payload as { message?: string };
    },
    onSuccess: async (result) => {
      toast.success(result.message ?? "Участие отозвано");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const myActive = useMemo(
    () => items.filter((i) => i.myOffer && i.myOffer.moderationStatus !== "ARCHIVED"),
    [items],
  );

  function openJoinForm(item: InstructorCatalogBrowseItemDTO) {
    setJoinForId(item.id);
    const offer = item.myOffer;
    if (offer && (offer.moderationStatus === "DRAFT" || offer.moderationStatus === "REJECTED")) {
      setForm({
        serviceNote: offer.serviceNote || offer.body || "",
        priceRub: offer.priceRub != null ? String(offer.priceRub) : "",
        maxRegistrations: offer.maxRegistrations != null ? String(offer.maxRegistrations) : "",
        eventAtLocal: offer.eventAt ? toDatetimeLocalValue(offer.eventAt) : emptyJoinForm(item).eventAtLocal,
      });
      return;
    }
    setForm(emptyJoinForm(item));
  }

  if (!cityReady) {
    return <p className="text-sm text-muted-foreground">Загрузка каталога…</p>;
  }

  const body = (
      <div className="space-y-4">
        {!hideCityPicker ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:min-w-[14rem]">
            <Label htmlFor="inst-catalog-city">Город</Label>
            <select
              id="inst-catalog-city"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={citySlug}
              onChange={(e) => changeCity(e.target.value)}
            >
              {MAP_CITY_CENTERS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="inst-catalog-q">Поиск</Label>
            <Input
              id="inst-catalog-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Название или место"
              maxLength={120}
            />
          </div>
        </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="inst-catalog-q">Поиск</Label>
            <Input
              id="inst-catalog-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Название или место"
              maxLength={120}
            />
          </div>
        )}

        {myActive.length ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Ваши заявки / участие · {selectedCity.name}</p>
            <ul className="mt-2 space-y-2">
              {myActive.map((item) => {
                const offer = item.myOffer!;
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{item.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {moderationStatusLabel(offer.moderationStatus)}
                        {offer.priceRub != null ? ` · ${formatEventPriceRu(offer.priceRub)}` : null}
                      </span>
                      {offer.rejectNote ? (
                        <p className="text-xs text-destructive">Комментарий: {offer.rejectNote}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(offer.moderationStatus === "DRAFT" ||
                        offer.moderationStatus === "REJECTED") && (
                        <Button type="button" size="sm" variant="secondary" onClick={() => openJoinForm(item)}>
                          Исправить и отправить
                        </Button>
                      )}
                      {offer.canWithdraw ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={withdraw.isPending}
                          onClick={() => {
                            if (confirm("Отозвать участие в этом мероприятии?")) {
                              withdraw.mutate(item.id);
                            }
                          }}
                        >
                          Отозвать
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : !items.length ? (
          <p className="text-sm text-muted-foreground">
            В «{selectedCity.name}» пока нет опубликованных карточек каталога
            {isFetching ? "…" : "."}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const thumb = publicUploadDisplaySrc(item.photoUrl);
              const offer = item.myOffer;
              const joinedLive =
                offer?.moderationStatus === "PUBLISHED" || offer?.moderationStatus === "PENDING_REVIEW";
              return (
                <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex gap-3">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                        🎿
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-medium">{item.title}</div>
                        <Badge variant="outline" className="text-xs">
                          {catalogStatusLabel(item.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.publishedOfferCount}{" "}
                        {item.publishedOfferCount === 1 ? "инструктор" : "инструкторов"}
                        {item.priceFromRub != null ? ` · от ${item.priceFromRub} ₽` : null}
                        {item.eventAt ? ` · ${formatEventDateRu(item.eventAt)}` : null}
                      </p>
                      {item.category ? (
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      ) : null}
                      {item.venueAddress ? (
                        <p className="text-xs text-muted-foreground">{item.venueAddress}</p>
                      ) : null}
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{item.body}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {joinedLive ? (
                      <Badge variant="secondary" className="text-xs">
                        {offer?.moderationStatus === "PUBLISHED"
                          ? "Вы в списке инструкторов"
                          : "Заявка на модерации"}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="accent"
                        onClick={() => openJoinForm(item)}
                      >
                        {offer?.moderationStatus === "REJECTED" || offer?.moderationStatus === "DRAFT"
                          ? "Исправить заявку"
                          : "Присоединиться"}
                      </Button>
                    )}
                  </div>

                  {joinForId === item.id ? (
                    <div className="mt-3 space-y-3 rounded-md border border-dashed border-border p-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`svc-${item.id}`}>Ваш сервис / условия</Label>
                        <textarea
                          id={`svc-${item.id}`}
                          className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          maxLength={1000}
                          placeholder="Что входит в вашу цену, экипировка, маршрут, опыт группы…"
                          value={form.serviceNote}
                          onChange={(e) => setForm((f) => ({ ...f, serviceNote: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Это увидит клиент под вашим именем. Общее описание мероприятия уже в карточке.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`price-${item.id}`}>Ваша цена, ₽</Label>
                          <Input
                            id={`price-${item.id}`}
                            inputMode="numeric"
                            placeholder="0 = бесплатно"
                            value={form.priceRub}
                            onChange={(e) => setForm((f) => ({ ...f, priceRub: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`seats-${item.id}`}>Мест (необяз.)</Label>
                          <Input
                            id={`seats-${item.id}`}
                            inputMode="numeric"
                            placeholder="Без лимита"
                            value={form.maxRegistrations}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, maxRegistrations: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`at-${item.id}`}>Дата / время</Label>
                          <Input
                            id={`at-${item.id}`}
                            type="datetime-local"
                            value={form.eventAtLocal}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, eventAtLocal: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="accent"
                          disabled={join.isPending || !form.serviceNote.trim()}
                          onClick={() => join.mutate(item.id)}
                        >
                          {join.isPending ? "Отправка…" : "Отправить на модерацию"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setJoinForId(null);
                            setForm(emptyJoinForm());
                          }}
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
      </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Карточки каталога · {selectedCity.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Присоединитесь к опубликованной карточке: укажите свою цену и описание сервиса. Клиент
            увидит вас в списке инструкторов под описанием мероприятия.
          </p>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Каталог мероприятий</CardTitle>
        <CardDescription>
          Присоединитесь к опубликованной карточке: укажите свою цену и описание сервиса. Клиент
          увидит вас в списке инструкторов под описанием мероприятия и сможет записаться к вам.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
