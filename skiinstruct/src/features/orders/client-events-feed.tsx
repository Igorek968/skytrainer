"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import {
  feedCardBadgeValue,
  feedCardDistanceKm,
  feedCardId,
  feedCardPhotoUrl,
  feedCardTitle,
  type ClientEventFeedCardDTO,
} from "@/lib/event-catalog";
import { EventRegistrationButton } from "@/features/orders/event-registration-button";
import { EventFeedPhoto } from "@/features/orders/event-feed-photo";
import { EventVenueDisplay } from "@/features/orders/event-venue-display";
import { EventViewerOverlay } from "@/features/orders/event-viewer-overlay";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { devPollInterval } from "@/lib/query-poll";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";

/** Задержка, чтобы отличить одиночный клик (раскрыть) от двойного (окно просмотра). */
const CLICK_VS_DBLCLICK_MS = 280;

/** Телефон / тач: первый тап сразу открывает полноэкранный просмотр. */
function shouldOpenViewerOnFirstTap(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 640px)").matches
  );
}

const UNLIMITED_STORAGE_KEY = "skiinstruct_client_events_unlimited";

function EventFeedDetails({
  event,
  queryKey,
  showDistance,
  isClient,
  compact,
  onInstructorPick,
}: {
  event: ClientInstructorEventDTO;
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
  compact?: boolean;
  onInstructorPick?: (instructor: { id: string; name: string | null }) => void;
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
        onInstructorPick ? (
          <button
            type="button"
            className="mt-0.5 text-left text-xs font-medium text-accent underline-offset-2 hover:underline"
            onClick={() =>
              onInstructorPick({ id: event.instructorId, name: event.instructorName ?? null })
            }
          >
            {event.instructorName}
          </button>
        ) : (
          <p className="mt-0.5 text-xs font-medium text-foreground">{event.instructorName}</p>
        )
      ) : null}
      <h3 className={cn("font-semibold text-foreground", compact ? "mt-1 text-sm" : "mt-1 text-sm")}>
        {event.title}
      </h3>
      {!compact ? <EventFeedPhoto event={event} /> : null}
      <EventVenueDisplay
        address={event.venueAddress}
        lat={event.venueLat}
        lng={event.venueLng}
        compact={compact}
      />
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

function CatalogCardDetails({
  card,
  showDistance,
}: {
  card: Extract<ClientEventFeedCardDTO, { kind: "catalog" }>;
  showDistance: boolean;
}) {
  const when = formatEventDateRu(card.eventAt);
  const names = card.offers
    .map((o) => o.instructorName?.trim())
    .filter((n): n is string => Boolean(n))
    .slice(0, 4);
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {when ? <time className="text-xs text-muted-foreground">{when}</time> : null}
        {showDistance && card.distanceKm != null ? (
          <span className="text-xs text-muted-foreground">· {formatDistanceKm(card.distanceKm)}</span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {card.offerCount} {card.offerCount === 1 ? "инструктор" : "инструктора"}
        {card.priceFromRub != null ? ` · от ${card.priceFromRub} ₽` : null}
      </p>
      <h3 className="mt-1 text-sm font-semibold text-foreground">{card.title}</h3>
      <EventVenueDisplay
        address={card.venueAddress}
        lat={card.venueLat}
        lng={card.venueLng}
        compact
      />
      <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {card.body}
      </p>
      {names.length ? (
        <p className="pt-1 text-xs text-muted-foreground">
          {names.join(", ")}
          {card.offerCount > names.length ? "…" : null}
        </p>
      ) : null}
      <p className="pt-1 text-xs text-accent">Открыть — выбрать инструктора и оплатить</p>
    </div>
  );
}

function EventFeedItem({
  card,
  queryKey,
  showDistance,
  isClient,
  onInstructorPick,
  onOpenViewer,
}: {
  card: ClientEventFeedCardDTO;
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
  onInstructorPick?: (instructor: { id: string; name: string | null }) => void;
  onOpenViewer?: (id: string) => void;
}) {
  const id = feedCardId(card);
  return (
    <article
      className="cursor-pointer border-b border-border pb-4 last:border-0 last:pb-0"
      onClick={(e) => {
        if (!onOpenViewer || !shouldOpenViewerOnFirstTap()) return;
        const t = e.target as HTMLElement | null;
        if (t?.closest("a, button, input, textarea, select, [role='button']")) return;
        onOpenViewer(id);
      }}
      onDoubleClick={() => onOpenViewer?.(id)}
      title={onOpenViewer ? "Нажмите, чтобы открыть на весь экран" : undefined}
    >
      {card.kind === "catalog" ? (
        <CatalogCardDetails card={card} showDistance={showDistance} />
      ) : (
        <EventFeedDetails
          event={card.event}
          queryKey={queryKey}
          showDistance={showDistance}
          isClient={isClient}
          onInstructorPick={onInstructorPick}
        />
      )}
    </article>
  );
}

function EventPosterCard({
  card,
  selected,
  onSelect,
  onOpenViewer,
  queryKey,
  showDistance,
  isClient,
  onInstructorPick,
}: {
  card: ClientEventFeedCardDTO;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onOpenViewer: (id: string) => void;
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
  onInstructorPick?: (instructor: { id: string; name: string | null }) => void;
}) {
  const id = feedCardId(card);
  const title = feedCardTitle(card);
  const badge = feedCardBadgeValue(card);
  const distanceKm = feedCardDistanceKm(card);
  const distanceTitle =
    distanceKm != null ? `${formatDistanceKm(distanceKm)} от вас` : undefined;
  const photoSrc = publicUploadDisplaySrc(feedCardPhotoUrl(card));
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const toggleSelected = () => onSelect(selected ? null : id);

  const handleClick = () => {
    if (shouldOpenViewerOnFirstTap()) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      onOpenViewer(id);
      return;
    }
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      toggleSelected();
    }, CLICK_VS_DBLCLICK_MS);
  };

  const handleDoubleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    onOpenViewer(id);
  };

  const subtitle =
    card.kind === "catalog"
      ? `${card.offerCount} инстр.`
      : card.event.instructorName ?? null;

  return (
    <div
      className={cn(
        "group shrink-0 snap-start text-left",
        selected ? "w-[min(100%,18rem)] sm:w-72" : "w-[7.25rem] sm:w-[8.5rem]",
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
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          className="block w-full text-left"
          aria-expanded={selected}
          aria-label={`${title}${distanceTitle ? `, ${distanceTitle}` : ""}. Нажмите, чтобы открыть`}
          title="Нажмите, чтобы открыть на весь экран"
        >
          <div
            className={cn(
              "relative overflow-hidden bg-muted",
              selected ? "aspect-[16/10]" : "aspect-[2/3]",
            )}
          >
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt={title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-slate-200 to-slate-300 px-2 text-center dark:from-slate-700 dark:to-slate-800">
                <span className="text-2xl" aria-hidden>
                  🎿
                </span>
                <span className="line-clamp-3 text-[10px] font-medium leading-tight text-slate-600 dark:text-slate-300">
                  {title}
                </span>
              </div>
            )}
            <span
              className="absolute bottom-2 left-2 min-w-[2rem] rounded-md bg-[#3dbb4e] px-1.5 py-0.5 text-center text-xs font-bold leading-none text-white shadow-sm"
              title={distanceTitle ?? "Цена или расстояние"}
            >
              {badge}
            </span>
            {card.kind === "catalog" && card.offerCount > 1 ? (
              <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {card.offerCount} инстр.
              </span>
            ) : null}
          </div>
          {!selected ? (
            <div className="px-0.5 pb-1.5 pt-1">
              <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">{title}</p>
              {subtitle ? (
                <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{subtitle}</p>
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
            {card.kind === "catalog" ? (
              <CatalogCardDetails card={card} showDistance={showDistance} />
            ) : (
              <EventFeedDetails
                event={card.event}
                queryKey={queryKey}
                showDistance={showDistance}
                isClient={isClient}
                compact
                onInstructorPick={onInstructorPick}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EventsCarousel({
  cards,
  queryKey,
  showDistance,
  isClient,
  onInstructorPick,
}: {
  cards: ClientEventFeedCardDTO[];
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
  onInstructorPick?: (instructor: { id: string; name: string | null }) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (!cards.length) {
      setSelectedId(null);
      setViewerIndex(null);
      return;
    }
    const ids = new Set(cards.map(feedCardId));
    setSelectedId((prev) => (prev && ids.has(prev) ? prev : null));
    setViewerIndex((prev) => {
      if (prev == null) return null;
      if (prev >= cards.length) return cards.length - 1;
      return prev;
    });
  }, [cards]);

  const openViewer = useCallback(
    (id: string) => {
      const idx = cards.findIndex((c) => feedCardId(c) === id);
      if (idx >= 0) setViewerIndex(idx);
    },
    [cards],
  );

  const updateScrollEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollEdges();
    el.addEventListener("scroll", updateScrollEdges, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollEdges) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollEdges);
      ro?.disconnect();
    };
  }, [cards, updateScrollEdges]);

  const scrollBy = useCallback(
    (delta: number) => {
      scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
      window.setTimeout(updateScrollEdges, 320);
    },
    [updateScrollEdges],
  );

  return (
    <div className="space-y-4">
      <div className="relative min-h-[26rem]">
        <div
          ref={scrollerRef}
          className="flex items-start gap-3 overflow-x-auto px-10 pb-1 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label="Мероприятия — карусель"
        >
          {cards.map((card) => {
            const id = feedCardId(card);
            return (
              <div key={id} role="listitem">
                <EventPosterCard
                  card={card}
                  selected={selectedId === id}
                  onSelect={setSelectedId}
                  onOpenViewer={openViewer}
                  queryKey={queryKey}
                  showDistance={showDistance}
                  isClient={isClient}
                  onInstructorPick={onInstructorPick}
                />
              </div>
            );
          })}
        </div>
        {canScrollLeft ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute -left-1 top-[38%] z-10 h-9 w-9 rounded-full border border-border bg-background shadow-md"
            aria-label="Прокрутить мероприятия влево"
            onClick={() => scrollBy(-320)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : null}
        {canScrollRight ? (
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
      {viewerIndex != null ? (
        <EventViewerOverlay
          cards={cards}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          queryKey={queryKey}
          showDistance={showDistance}
          isClient={isClient}
          onInstructorPick={onInstructorPick}
        />
      ) : null}
    </div>
  );
}

function EventsList({
  cards,
  queryKey,
  showDistance,
  isClient,
  onInstructorPick,
}: {
  cards: ClientEventFeedCardDTO[];
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
  onInstructorPick?: (instructor: { id: string; name: string | null }) => void;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!cards.length) {
      setViewerIndex(null);
      return;
    }
    setViewerIndex((prev) => {
      if (prev == null) return null;
      if (prev >= cards.length) return cards.length - 1;
      return prev;
    });
  }, [cards]);

  const openViewer = useCallback(
    (id: string) => {
      const idx = cards.findIndex((c) => feedCardId(c) === id);
      if (idx >= 0) setViewerIndex(idx);
    },
    [cards],
  );

  return (
    <>
      <div className="max-h-80 space-y-4 overflow-y-auto pr-1" role="feed" aria-label="Мероприятия">
        {cards.map((card) => (
          <EventFeedItem
            key={feedCardId(card)}
            card={card}
            queryKey={queryKey}
            showDistance={showDistance}
            isClient={isClient}
            onInstructorPick={onInstructorPick}
            onOpenViewer={openViewer}
          />
        ))}
      </div>
      {viewerIndex != null ? (
        <EventViewerOverlay
          cards={cards}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          queryKey={queryKey}
          showDistance={showDistance}
          isClient={isClient}
          onInstructorPick={onInstructorPick}
        />
      ) : null}
    </>
  );
}

function normalizeFeedCards(
  cards: ClientEventFeedCardDTO[] | undefined,
  events: ClientInstructorEventDTO[] | undefined,
): ClientEventFeedCardDTO[] {
  if (cards?.length) {
    return cards
      .map((c) => {
        if (c.kind !== "catalog") return c;
        const offers = c.offers.filter((o) => !o.isCompleted);
        if (!offers.length) return null;
        return { ...c, offers, offerCount: offers.length };
      })
      .filter((c): c is ClientEventFeedCardDTO => {
        if (!c) return false;
        return c.kind === "catalog" ? true : !c.event.isCompleted;
      });
  }
  return (events ?? [])
    .filter((ev) => !ev.isCompleted)
    .map((event) => ({ kind: "single" as const, event }));
}

export function ClientEventsFeed({
  layout = "carousel",
  onInstructorPick,
}: {
  layout?: "carousel" | "list";
  onInstructorPick?: (instructor: { id: string; name: string | null }) => void;
}) {
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";
  const meetLat = useMeetPoint((s) => s.meetLat);
  const meetLng = useMeetPoint((s) => s.meetLng);

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
        cards?: ClientEventFeedCardDTO[];
        events: ClientInstructorEventDTO[];
        meta?: { shown: number; totalPublished: number };
      }>;
    },
    staleTime: 15_000,
    refetchInterval: devPollInterval(30_000),
    refetchIntervalInBackground: false,
  });

  const cards = normalizeFeedCards(data?.cards, data?.events);

  const feedDescription = unlimited
    ? "Все опубликованные — сначала ближайшие к точке на карте"
    : `В радиусе ${CLIENT_EVENTS_RADIUS_KM} км от вашей точки на карте`;

  const badgeHint =
    layout === "carousel"
      ? "Одинаковые туры схлопываются в одну карточку. Зелёная метка: расстояние или цена. На телефоне — тап на весь экран."
      : "Нажмите мероприятие, чтобы открыть на весь экран.";

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="text-base">Мероприятия</CardTitle>
          <CardDescription>
            {feedDescription}
            {badgeHint ? <span className="mt-1 block text-[11px]">{badgeHint}</span> : null}
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
        ) : cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {unlimited
              ? "Пока нет опубликованных мероприятий."
              : `В радиусе ${CLIENT_EVENTS_RADIUS_KM} км от вашей точки на карте мероприятий нет. Отметьте себя на карте или включите «Показать все мероприятия».`}
          </p>
        ) : layout === "carousel" ? (
          <EventsCarousel
            cards={cards}
            queryKey={queryKey}
            showDistance
            isClient={isClient}
            onInstructorPick={onInstructorPick}
          />
        ) : (
          <EventsList
            cards={cards}
            queryKey={queryKey}
            showDistance
            isClient={isClient}
            onInstructorPick={onInstructorPick}
          />
        )}
      </CardContent>
    </Card>
  );
}
