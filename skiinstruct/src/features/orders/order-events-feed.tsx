"use client";

import { useQuery } from "@tanstack/react-query";

import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventDateRu } from "@/lib/instructor-events";
import { EventRegistrationButton } from "@/features/orders/event-registration-button";
import { EventFeedPhoto } from "@/features/orders/event-feed-photo";
import { EventVenueDisplay } from "@/features/orders/event-venue-display";
import { devPollInterval } from "@/lib/query-poll";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

function EventFeedItem({
  event,
  queryKey,
}: {
  event: ClientInstructorEventDTO;
  queryKey: string[];
}) {
  const when = formatEventDateRu(event.eventAt) ?? formatEventDateRu(event.createdAt);
  return (
    <article className="border-b border-border pb-4 last:border-0 last:pb-0">
      <time className="text-xs text-muted-foreground">{when}</time>
      <h3 className="mt-1 text-sm font-semibold text-foreground">{event.title}</h3>
      <EventFeedPhoto event={event} />
      <EventVenueDisplay address={event.venueAddress} lat={event.venueLat} lng={event.venueLng} />
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {event.body}
      </p>
      <EventRegistrationButton event={event} queryKey={queryKey} />
    </article>
  );
}

export function OrderEventsFeed({
  orderId,
  instructorName,
}: {
  orderId: string;
  instructorName?: string | null;
}) {
  const queryKey = ["order-events", orderId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/orders/${orderId}/events`, { credentials: "include" });
      if (!r.ok) throw new Error("events");
      return r.json() as Promise<{ events: ClientInstructorEventDTO[] }>;
    },
    staleTime: 15_000,
    refetchInterval: devPollInterval(30_000),
    refetchIntervalInBackground: false,
  });

  const events = (data?.events ?? []).filter((ev) => !ev.isCompleted);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Мероприятия</CardTitle>
        <CardDescription>
          {instructorName
            ? `События и запись — ${instructorName}`
            : "События и запись у вашего инструктора"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">Не удалось загрузить ленту.</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет объявлений по этому заказу.</p>
        ) : (
          <div className="max-h-80 space-y-4 overflow-y-auto pr-1" role="feed" aria-label="Мероприятия">
            {events.map((ev) => (
              <EventFeedItem key={ev.id} event={ev} queryKey={queryKey} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
