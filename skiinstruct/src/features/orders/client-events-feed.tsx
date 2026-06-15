"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useMeetPoint } from "@/features/map/use-client-meet-point";
import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventDateRu } from "@/lib/instructor-events";
import {
  CLIENT_EVENTS_RADIUS_KM,
  formatDistanceKm,
} from "@/lib/client-events-geo";
import { EventRegistrationButton } from "@/features/orders/event-registration-button";
import { EventFeedPhoto } from "@/features/orders/event-feed-photo";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { devPollInterval } from "@/lib/query-poll";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";

const UNLIMITED_STORAGE_KEY = "skiinstruct_client_events_unlimited";

/** Число в зелёном бейдже (как рейтинг на постере): одна цифра после запятой. */
function eventPosterBadgeValue(event: ClientInstructorEventDTO): string {
  if (event.distanceKm != null && Number.isFinite(event.distanceKm) && event.distanceKm < 9000) {
    return event.distanceKm.toFixed(1).replace(".", ",");
  }
  if (event.isFree || event.priceRub == null || event.priceRub <= 0) return "0";
  if (event.priceRub < 1000) return String(event.priceRub);
  return (event.priceRub / 1000).toFixed(1).replace(".", ",");
}

function EventFeedDetails({
  event,
  queryKey,
  showDistance,
  isClient,
  compact,
}: {
  event: ClientInstructorEventDTO;
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
  compact?: boolean;
}) {
  const when = formatEventDateRu(event.eventAt) ?? formatEventDateRu(event.createdAt);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <time className="text-xs text-muted-foreground">{when}</time>
        {showDistance && event.distanceKm != null ? (
          <span className="text-xs text-muted-foreground">· {formatDistanceKm(event.distanceKm)}</span>
        ) : null}
      </div>
      {event.instructorName ? (
        <p className="mt-0.5 text-xs font-medium text-foreground">{event.instructorName}</p>
      ) : null}
      <h3 className={cn("font-semibold text-foreground", compact ? "mt-1 text-sm" : "mt-1 text-sm")}>
        {event.title}
      </h3>
      {!compact ? <EventFeedPhoto event={event} /> : null}
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{event.body}</p>
      {isClient ? (
        <EventRegistrationButton event={event} queryKey={queryKey} />
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          <Link href="/login?callbackUrl=/client" className="font-medium text-accent underline">
            Войдите как клиент
          </Link>
          , чтобы записаться на мероприятие.
        </p>
      )}
    </>
  );
}

function EventFeedItem({
  event,
  queryKey,
  showDistance,
  isClient,
}: {
  event: ClientInstructorEventDTO;
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
}) {
  return (
    <article className="border-b border-border pb-4 last:border-0 last:pb-0">
      <EventFeedDetails event={event} queryKey={queryKey} showDistance={showDistance} isClient={isClient} />
    </article>
  );
}

function EventPosterCard({
  event,
  selected,
  onSelect,
  queryKey,
  showDistance,
  isClient,
}: {
  event: ClientInstructorEventDTO;
  selected: boolean;
  onSelect: (id: string | null) => void;
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
}) {
  const badge = eventPosterBadgeValue(event);
  const distanceTitle =
    event.distanceKm != null ? `${formatDistanceKm(event.distanceKm)} от вас` : undefined;

  const toggleSelected = () => onSelect(selected ? null : event.id);

  return (
    <div
      className={cn(
        "group shrink-0 snap-start text-left transition-[width] duration-200",
        selected
          ? "w-[min(100%,18rem)] sm:w-72"
          : "w-[7.25rem] sm:w-[8.5rem]",
        selected && "rounded-2xl ring-2 ring-accent ring-offset-2 ring-offset-background",
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-background shadow-sm",
          !selected && "transition-transform group-hover:scale-[1.02]",
        )}
      >
        <button
          type="button"
          onClick={toggleSelected}
          className="block w-full text-left"
          aria-expanded={selected}
          aria-label={`${event.title}${distanceTitle ? `, ${distanceTitle}` : ""}`}
        >
          <div className={cn("relative overflow-hidden bg-muted", selected ? "aspect-[16/10]" : "aspect-[2/3]")}>
            {publicUploadDisplaySrc(event.photoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={publicUploadDisplaySrc(event.photoUrl)!}
                alt={event.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-slate-200 to-slate-300 px-2 text-center dark:from-slate-700 dark:to-slate-800">
                <span className="text-2xl" aria-hidden>
                  🎿
                </span>
                <span className="line-clamp-3 text-[10px] font-medium leading-tight text-slate-600 dark:text-slate-300">
                  {event.title}
                </span>
              </div>
            )}
            <span
              className="absolute bottom-2 left-2 min-w-[2rem] rounded-md bg-[#3dbb4e] px-1.5 py-0.5 text-center text-xs font-bold leading-none text-white shadow-sm"
              title={distanceTitle ?? "Цена или расстояние"}
            >
              {badge}
            </span>
          </div>
          {!selected ? (
            <div className="px-0.5 pb-1.5 pt-1">
              <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">{event.title}</p>
              {event.instructorName ? (
                <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{event.instructorName}</p>
              ) : null}
            </div>
          ) : null}
        </button>
        {selected ? (
          <div
            className="relative z-10 space-y-0.5 touch-manipulation p-3"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <EventFeedDetails
              event={event}
              queryKey={queryKey}
              showDistance={showDistance}
              isClient={isClient}
              compact
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EventsCarousel({
  events,
  queryKey,
  showDistance,
  isClient,
}: {
  events: ClientInstructorEventDTO[];
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!events.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && events.some((e) => e.id === prev) ? prev : null));
  }, [events]);

  const scrollBy = useCallback((delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto pb-1 pr-12 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label="Мероприятия — карусель"
        >
          {events.map((ev) => (
            <div key={ev.id} role="listitem">
              <EventPosterCard
                event={ev}
                selected={selectedId === ev.id}
                onSelect={setSelectedId}
                queryKey={queryKey}
                showDistance={showDistance}
                isClient={isClient}
              />
            </div>
          ))}
        </div>
        {events.length > 3 ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute -right-1 top-[38%] z-10 h-9 w-9 rounded-full border border-border bg-background shadow-md"
            aria-label="Прокрутить мероприятия вправо"
            onClick={() => scrollBy(320)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ClientEventsFeed({ layout = "carousel" }: { layout?: "carousel" | "list" }) {
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";
  const meetLat = useMeetPoint((s) => s.meetLat);
  const meetLng = useMeetPoint((s) => s.meetLng);

  /** По умолчанию — все опубликованные; в localStorage можно сохранить режим «только рядом». */
  const [unlimited, setUnlimited] = useState(true);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(UNLIMITED_STORAGE_KEY);
      if (stored === "1") setUnlimited(true);
      else if (stored === "0") setUnlimited(false);
    } catch {
      setUnlimited(true);
    }
    setPrefsReady(true);
  }, []);

  const toggleUnlimited = useCallback((checked: boolean) => {
    setUnlimited(checked);
    try {
      localStorage.setItem(UNLIMITED_STORAGE_KEY, checked ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const queryKey = [
    "client-events",
    String(meetLat),
    String(meetLng),
    unlimited ? "all" : "nearby",
  ];

  const { data, isLoading, error } = useQuery({
    queryKey,
    enabled: prefsReady,
    queryFn: async () => {
      const qs = new URLSearchParams({
        lat: String(meetLat),
        lng: String(meetLng),
        radiusKm: String(CLIENT_EVENTS_RADIUS_KM),
        unlimited: unlimited ? "1" : "0",
      });
      const r = await fetch(`/api/client/events?${qs}`, { credentials: "include" });
      if (!r.ok) {
        let msg = "Не удалось загрузить мероприятия";
        try {
          const j = (await r.json()) as { error?: string };
          if (typeof j.error === "string" && j.error.length > 0) msg = j.error;
        } catch {
          /* ignore */
        }
        if (r.status === 401) msg = "Войдите как клиент, чтобы видеть мероприятия";
        throw new Error(msg);
      }
      return r.json() as Promise<{
        events: ClientInstructorEventDTO[];
        meta?: { shown: number; totalPublished: number };
      }>;
    },
    staleTime: 15_000,
    refetchInterval: devPollInterval(30_000),
    refetchIntervalInBackground: false,
  });

  const events = (data?.events ?? []).filter((ev) => !ev.isCompleted);

  const feedDescription = unlimited
    ? "Все опубликованные — сначала ближайшие к точке на карте"
    : `В радиусе ${CLIENT_EVENTS_RADIUS_KM} км от вашей точки на карте`;

  const badgeHint =
    layout === "carousel"
      ? "Зелёная метка: расстояние до инструктора (км) или цена (тыс. ₽)."
      : undefined;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="text-base">Мероприятия</CardTitle>
          <CardDescription>
            {feedDescription}
            {badgeHint ? (
              <span className="mt-1 block text-[11px]">{badgeHint}</span>
            ) : null}
          </CardDescription>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
            checked={unlimited}
            onChange={(e) => toggleUnlimited(e.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">Показать все мероприятия</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Без ограничения по расстоянию; список отсортирован от ближайших к дальним
            </span>
          </span>
        </label>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            <Skeleton className="h-[10.5rem] w-[7.25rem] shrink-0 rounded-2xl" />
            <Skeleton className="h-[10.5rem] w-[7.25rem] shrink-0 rounded-2xl" />
            <Skeleton className="h-[10.5rem] w-[7.25rem] shrink-0 rounded-2xl" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {unlimited
              ? "Пока нет опубликованных мероприятий."
              : `В радиусе ${CLIENT_EVENTS_RADIUS_KM} км от вашей точки на карте мероприятий нет. Отметьте себя на карте или включите «Показать все мероприятия».`}
          </p>
        ) : layout === "carousel" ? (
          <EventsCarousel events={events} queryKey={queryKey} showDistance isClient={isClient} />
        ) : (
          <div className="max-h-80 space-y-4 overflow-y-auto pr-1" role="feed" aria-label="Мероприятия">
            {events.map((ev) => (
              <EventFeedItem
                key={ev.id}
                event={ev}
                queryKey={queryKey}
                showDistance
                isClient={isClient}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
