"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { useMeetPoint } from "@/features/map/use-client-meet-point";
import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventDateRu } from "@/lib/instructor-events";
import {
  CLIENT_EVENTS_RADIUS_KM,
  formatDistanceKm,
} from "@/lib/client-events-geo";
import { EventRegistrationButton } from "@/features/orders/event-registration-button";
import { EventFeedPhoto } from "@/features/orders/event-feed-photo";
import { devPollInterval } from "@/lib/query-poll";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

const UNLIMITED_STORAGE_KEY = "skiinstruct_client_events_unlimited";

function EventFeedItem({
  event,
  queryKey,
  showDistance,
}: {
  event: ClientInstructorEventDTO;
  queryKey: string[];
  showDistance: boolean;
}) {
  const when = formatEventDateRu(event.eventAt) ?? formatEventDateRu(event.createdAt);
  return (
    <article className="border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <time className="text-xs text-muted-foreground">{when}</time>
        {showDistance && event.distanceKm != null ? (
          <span className="text-xs text-muted-foreground">· {formatDistanceKm(event.distanceKm)}</span>
        ) : null}
      </div>
      {event.instructorName ? (
        <p className="mt-0.5 text-xs font-medium text-foreground">{event.instructorName}</p>
      ) : null}
      <h3 className="mt-1 text-sm font-semibold text-foreground">{event.title}</h3>
      <EventFeedPhoto event={event} />
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {event.body}
      </p>
      <EventRegistrationButton event={event} queryKey={queryKey} />
    </article>
  );
}

export function ClientEventsFeed() {
  const { data: session } = useSession();
  const enabled = session?.user?.role === "CLIENT";
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
    enabled: enabled && prefsReady,
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

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Мероприятия</CardTitle>
          <CardDescription>Объявления и запись на мероприятия инструкторов платформы</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Войдите как клиент, чтобы видеть объявления и записываться на мероприятия.
          </p>
        </CardContent>
      </Card>
    );
  }

  const feedDescription = unlimited
    ? "Все опубликованные мероприятия — сначала ближайшие к вашей точке на карте"
    : `Мероприятия в радиусе ${CLIENT_EVENTS_RADIUS_KM} км от вашей точки на карте`;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="text-base">Мероприятия</CardTitle>
          <CardDescription>{feedDescription}</CardDescription>
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
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {unlimited
              ? "Пока нет опубликованных мероприятий."
              : `В радиусе ${CLIENT_EVENTS_RADIUS_KM} км от вашей точки на карте мероприятий нет. Отметьте себя на карте или включите «Показать все мероприятия».`}
          </p>
        ) : (
          <div className="max-h-80 space-y-4 overflow-y-auto pr-1" role="feed" aria-label="Мероприятия">
            {events.map((ev) => (
              <EventFeedItem
                key={ev.id}
                event={ev}
                queryKey={queryKey}
                showDistance
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
