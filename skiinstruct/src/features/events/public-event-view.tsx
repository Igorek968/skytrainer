"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { CopyEventLinkButton } from "@/features/events/copy-event-link-button";
import { EventFeedPhoto } from "@/features/orders/event-feed-photo";
import { EventRegistrationButton } from "@/features/orders/event-registration-button";
import { EventReviewsFeed } from "@/features/orders/event-reviews-feed";
import { EventVenueDisplay } from "@/features/orders/event-venue-display";
import { emptyEventReviewsSummary } from "@/lib/event-reviews";
import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventDateRu, formatEventPriceRu } from "@/lib/instructor-events";
import { Button } from "@/shared/ui/button";

function guestReturnPath(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

export function PublicEventView({ event }: { event: ClientInstructorEventDTO }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isClient = session?.user?.role === "CLIENT";
  const when = formatEventDateRu(event.eventAt);
  const next = guestReturnPath(pathname, searchParams.toString());
  const registerHref = `/register?callbackUrl=${encodeURIComponent(next)}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(next)}`;

  return (
    <article className="mx-auto max-w-3xl space-y-6 py-2">
      <p className="text-sm text-muted-foreground">
        <Link href="/events" className="underline-offset-2 hover:underline">
          Все события
        </Link>
        {" · ТвойТренер.рф"}
      </p>

      <header className="space-y-2">
        {event.category ? (
          <p className="text-sm font-medium tracking-wide text-accent">{event.category}</p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{event.title}</h1>
        <p className="text-muted-foreground">
          {when ? <time dateTime={event.eventAt ?? undefined}>{when}</time> : "Дата уточняется"}
          {event.instructorName ? ` · ${event.instructorName}` : ""}
          {` · ${formatEventPriceRu(event.priceRub)}`}
        </p>
      </header>

      <EventFeedPhoto event={event} className="overflow-hidden rounded-lg border border-border" />

      {event.body.trim() ? (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">{event.body}</p>
      ) : null}

      <EventVenueDisplay
        address={event.venueAddress}
        lat={event.venueLat}
        lng={event.venueLng}
      />

      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">Загружаем запись…</p>
      ) : isClient ? (
        <EventRegistrationButton event={event} queryKey={["public-event", event.id]} />
      ) : session?.user ? (
        <p className="text-sm text-muted-foreground">
          Записаться можно из кабинета клиента. Сейчас вы вошли под другой ролью.
        </p>
      ) : (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Чтобы записаться, войдите или создайте аккаунт клиента — вернём на это событие.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="accent">
              <Link href={registerHref}>Записаться</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={loginHref}>У меня уже есть аккаунт</Link>
            </Button>
          </div>
        </div>
      )}

      <EventReviewsFeed
        eventId={event.catalogItemId ? undefined : event.id}
        catalogId={event.catalogItemId}
        summary={{
          ratingAvg: event.ratingAvg ?? null,
          reviewCount: event.reviewCount ?? 0,
          reviewsPreview: event.reviewsPreview ?? emptyEventReviewsSummary().reviewsPreview,
        }}
      />

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <CopyEventLinkButton eventId={event.id} />
        {event.instructorId ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/instructors/${event.instructorId}`}>Профиль инструктора</Link>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
