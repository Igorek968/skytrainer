"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { EventRegistrationButton } from "@/features/orders/event-registration-button";
import { EventVenueDisplay } from "@/features/orders/event-venue-display";
import { formatDistanceKm } from "@/lib/client-events-geo";
import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventDateRu } from "@/lib/instructor-events";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { Button } from "@/shared/ui/button";

const SWIPE_THRESHOLD_PX = 56;

export function EventViewerOverlay({
  events,
  index,
  onIndexChange,
  onClose,
  queryKey,
  showDistance,
  isClient,
  onInstructorPick,
}: {
  events: ClientInstructorEventDTO[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  queryKey: string[];
  showDistance: boolean;
  isClient: boolean;
  onInstructorPick?: (instructor: { id: string; name: string | null }) => void;
}) {
  const event = events[index];
  const canPrev = index > 0;
  const canNext = index < events.length - 1;
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index < events.length - 1) onIndexChange(index + 1);
  }, [events.length, index, onIndexChange]);

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

  if (!event) return null;

  const photoSrc = publicUploadDisplaySrc(event.photoUrl);
  const when = formatEventDateRu(event.eventAt) ?? formatEventDateRu(event.createdAt);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black sm:items-center sm:bg-black/80 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Мероприятие: ${event.title}`}
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
          aria-label="Предыдущее мероприятие"
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
          aria-label="Следующее мероприятие"
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
        <div className="relative max-h-[48dvh] shrink-0 bg-black sm:max-h-[55vh]">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt={event.title}
              className="mx-auto h-full max-h-[48dvh] w-full object-contain sm:max-h-[55vh]"
            />
          ) : (
            <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-b from-slate-700 to-slate-900 text-4xl text-white/80">
              🎿
            </div>
          )}
          <p className="absolute bottom-2 right-3 rounded bg-black/55 px-2 py-0.5 text-xs text-white/90">
            {index + 1} / {events.length}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <time className="text-xs text-muted-foreground">{when}</time>
            {showDistance && event.distanceKm != null ? (
              <span className="text-xs text-muted-foreground">
                · {formatDistanceKm(event.distanceKm)}
              </span>
            ) : null}
          </div>
          {event.instructorName ? (
            onInstructorPick ? (
              <button
                type="button"
                className="text-left text-xs font-medium text-accent underline-offset-2 hover:underline"
                onClick={() => {
                  onInstructorPick({ id: event.instructorId, name: event.instructorName ?? null });
                  onClose();
                }}
              >
                {event.instructorName}
              </button>
            ) : (
              <p className="text-xs font-medium text-foreground">{event.instructorName}</p>
            )
          ) : null}
          <h2 className="text-lg font-semibold text-foreground">{event.title}</h2>
          <EventVenueDisplay
            address={event.venueAddress}
            lat={event.venueLat}
            lng={event.venueLng}
          />
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {event.body}
          </p>
          {isClient ? (
            <EventRegistrationButton event={event} queryKey={queryKey} />
          ) : (
            <p className="text-xs text-muted-foreground">
              <Link href="/login?callbackUrl=/client" className="font-medium text-accent underline">
                Войдите как клиент
              </Link>
              , чтобы записаться на мероприятие.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
