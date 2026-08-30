"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { EventRegistrationButton } from "@/features/orders/event-registration-button";
import { EventReviewsFeed } from "@/features/orders/event-reviews-feed";
import { EventVenueDisplay } from "@/features/orders/event-venue-display";
import { formatDistanceKm } from "@/lib/client-events-geo";
import {
  feedCardPhotoUrl,
  feedCardReviewsSummary,
  feedCardTitle,
  type ClientEventFeedCardDTO,
} from "@/lib/event-catalog";
import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { EventRatingBadge } from "@/features/orders/event-rating-badge";
import { formatEventDateRu } from "@/lib/instructor-events";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { Button } from "@/shared/ui/button";

const SWIPE_THRESHOLD_PX = 56;

function OfferBlock({
  event,
  queryKey,
  showDistance,
  isClient,
  onInstructorPick,
  onClose,
}: {
  event: ClientInstructorEventDTO;
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
  onInstructorPick?: (instructor: { id: string; name: string | null }) => void;
  onClose: () => void;
}) {
  const serviceNote = event.body?.trim();
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {event.instructorName ? (
          onInstructorPick ? (
            <button
              type="button"
              className="text-left text-sm font-medium text-accent underline-offset-2 hover:underline"
              onClick={() => {
                onInstructorPick({ id: event.instructorId, name: event.instructorName ?? null });
                onClose();
              }}
            >
              {event.instructorName}
            </button>
          ) : (
            <p className="text-sm font-medium text-foreground">{event.instructorName}</p>
          )
        ) : (
          <p className="text-sm font-medium text-foreground">Инструктор</p>
        )}
        {showDistance && event.distanceKm != null ? (
          <span className="text-xs text-muted-foreground">
            · {formatDistanceKm(event.distanceKm)}
          </span>
        ) : null}
        {event.priceRub != null && event.priceRub > 0 ? (
          <span className="text-xs font-medium text-foreground">· {event.priceRub} ₽</span>
        ) : (
          <span className="text-xs text-muted-foreground">· бесплатно</span>
        )}
      </div>
      {serviceNote ? (
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {serviceNote}
        </p>
      ) : null}
      {isClient ? (
        <div className="mt-2">
          <EventRegistrationButton event={event} queryKey={queryKey} />
        </div>
      ) : null}
    </div>
  );
}

export function EventViewerOverlay({
  cards,
  index,
  onIndexChange,
  onClose,
  queryKey,
  showDistance,
  isClient,
  onInstructorPick,
}: {
  cards: ClientEventFeedCardDTO[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
  onInstructorPick?: (instructor: { id: string; name: string | null }) => void;
}) {
  const card = cards[index];
  const canPrev = index > 0;
  const canNext = index < cards.length - 1;
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index < cards.length - 1) onIndexChange(index + 1);
  }, [cards.length, index, onIndexChange]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  if (!card) return null;

  const title = feedCardTitle(card);
  const photoSrc = publicUploadDisplaySrc(feedCardPhotoUrl(card));
  const when =
    card.kind === "catalog"
      ? formatEventDateRu(card.eventAt)
      : formatEventDateRu(card.event.eventAt) ?? formatEventDateRu(card.event.createdAt);
  const distanceKm = card.kind === "catalog" ? card.distanceKm : card.event.distanceKm;
  const venueAddress = card.kind === "catalog" ? card.venueAddress : card.event.venueAddress;
  const venueLat = card.kind === "catalog" ? card.venueLat : card.event.venueLat;
  const venueLng = card.kind === "catalog" ? card.venueLng : card.event.venueLng;
  const body = card.kind === "catalog" ? card.body : card.event.body;
  const reviews = feedCardReviewsSummary(card);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black sm:items-center sm:bg-black/80 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Событие: ${title}`}
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null) return;
        const end = e.changedTouches[0]?.clientX;
        if (end == null) return;
        const delta = end - start;
        if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
        if (delta > 0) goPrev();
        else goNext();
      }}
    >
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-3 top-3 z-20 h-11 w-11 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/70"
        aria-label="Закрыть"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="h-5 w-5" />
      </Button>

      {canPrev ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute left-2 top-[28%] z-20 h-11 w-11 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/70 sm:left-4 sm:top-1/2"
          aria-label="Предыдущее событие"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      ) : null}

      {canNext ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-2 top-[28%] z-20 h-11 w-11 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/70 sm:right-4 sm:top-1/2"
          aria-label="Следующее событие"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      ) : null}

      <div
        className="relative flex h-full w-full max-h-none max-w-none flex-col overflow-hidden rounded-none border-0 bg-background shadow-none sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-xl sm:border sm:border-white/15 sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative max-h-[42dvh] shrink-0 bg-black sm:max-h-[50vh]">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt={title}
              className="mx-auto h-full max-h-[42dvh] w-full object-contain sm:max-h-[50vh]"
            />
          ) : (
            <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-b from-slate-700 to-slate-900 text-4xl text-white/80">
              🎿
            </div>
          )}
          <EventRatingBadge
            ratingAvg={reviews.ratingAvg}
            reviewCount={reviews.reviewCount}
            className="bottom-2 left-2"
          />
          <p className="absolute bottom-2 right-3 rounded bg-black/55 px-2 py-0.5 text-xs text-white/90">
            {index + 1} / {cards.length}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {when ? <time className="text-xs text-muted-foreground">{when}</time> : null}
            {showDistance && distanceKm != null ? (
              <span className="text-xs text-muted-foreground">· {formatDistanceKm(distanceKm)}</span>
            ) : null}
            {card.kind === "catalog" ? (
              <span className="text-xs text-muted-foreground">
                · {card.offerCount}{" "}
                {card.offerCount === 1 ? "инструктор" : "инструктора"}
                {card.priceFromRub != null ? ` · от ${card.priceFromRub} ₽` : null}
              </span>
            ) : null}
          </div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {card.kind === "catalog" && card.category ? (
            <p className="text-xs text-muted-foreground">{card.category}</p>
          ) : card.kind === "single" && card.event.category ? (
            <p className="text-xs text-muted-foreground">{card.event.category}</p>
          ) : null}
          <EventVenueDisplay address={venueAddress} lat={venueLat} lng={venueLng} />
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{body}</p>

          {card.kind === "catalog" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Выберите инструктора</p>
              <p className="text-xs text-muted-foreground">
                У каждого своя цена и условия. Оплата идёт выбранному инструктору.
              </p>
              {card.offers.map((offer) => (
                <OfferBlock
                  key={offer.id}
                  event={offer}
                  queryKey={queryKey}
                  showDistance={showDistance}
                  isClient={isClient}
                  onInstructorPick={onInstructorPick}
                  onClose={onClose}
                />
              ))}
              {!isClient ? (
                <p className="text-xs text-muted-foreground">
                  <Link href="/login?callbackUrl=/client" className="font-medium text-accent underline">
                    Войдите как клиент
                  </Link>
                  , чтобы записаться на событие.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {card.event.instructorName ? (
                onInstructorPick ? (
                  <button
                    type="button"
                    className="text-left text-xs font-medium text-accent underline-offset-2 hover:underline"
                    onClick={() => {
                      onInstructorPick({
                        id: card.event.instructorId,
                        name: card.event.instructorName ?? null,
                      });
                      onClose();
                    }}
                  >
                    {card.event.instructorName}
                  </button>
                ) : (
                  <p className="text-xs font-medium text-foreground">{card.event.instructorName}</p>
                )
              ) : null}
              {isClient ? (
                <EventRegistrationButton event={card.event} queryKey={queryKey} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  <Link href="/login?callbackUrl=/client" className="font-medium text-accent underline">
                    Войдите как клиент
                  </Link>
                  , чтобы записаться на событие.
                </p>
              )}
            </>
          )}

          <EventReviewsFeed
            eventId={card.kind === "single" ? card.event.id : undefined}
            catalogId={card.kind === "catalog" ? card.catalogId : card.event.catalogItemId}
            summary={reviews}
          />
        </div>
      </div>
    </div>
  );
}
