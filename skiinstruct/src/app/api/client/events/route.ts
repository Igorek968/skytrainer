import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveOptionalClientUserId } from "@/lib/api-session";
import {
  CLIENT_EVENTS_RADIUS_KM,
  filterAndSortEventsByDistance,
  instructorEventDistanceKm,
  resolveClientEventsOrigin,
} from "@/lib/client-events-geo";
import { buildClientEventFeedCards, feedCardCategory } from "@/lib/event-catalog";
import { canonicalizeActivityLabel } from "@/lib/services/instructor-match";
import { enrichClientEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import {
  activePublishedEventWhere,
  archivePastPublishedInstructorEvents,
  isVisibleInClientEventFeed,
} from "@/lib/services/instructor-event-expiry";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(500).optional().default(CLIENT_EVENTS_RADIUS_KM),
  unlimited: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  /** Пусто / отсутствует = «Все» категории. */
  category: z.string().trim().max(120).optional(),
});

export async function GET(req: Request) {
  const clientId = await resolveOptionalClientUserId();

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lat, lng, radiusKm, unlimited } = parsed.data;
  const categoryFilter = parsed.data.category?.trim()
    ? canonicalizeActivityLabel(parsed.data.category.trim())
    : null;
  const origin = resolveClientEventsOrigin(lat, lng);
  const now = new Date();

  await archivePastPublishedInstructorEvents({ now });

  const rows = await prisma.instructorEvent.findMany({
    where: activePublishedEventWhere(now),
    orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      instructor: {
        select: {
          name: true,
          instructorProfile: { select: { lat: true, lng: true, ratingAvg: true } },
        },
      },
      slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
      registrations: clientId
        ? { where: { clientId }, take: 10 }
        : { take: 0 },
      catalogItem: {
        select: {
          id: true,
          title: true,
          body: true,
          category: true,
          photoUrl: true,
          eventAt: true,
          venueAddress: true,
          venueLat: true,
          venueLng: true,
          status: true,
        },
      },
    },
  });

  const withDistance = await Promise.all(
    rows.map(async (row) => {
      const profile = row.instructor.instructorProfile;
      const distanceKm = instructorEventDistanceKm(
        origin.lat,
        origin.lng,
        profile?.lat ?? null,
        profile?.lng ?? null,
        row.venueLat,
        row.venueLng,
      );
      const event = await enrichClientEvent(
        row,
        row.registrations[0] ?? null,
        row.instructor.name,
        clientId,
        row.instructor.instructorProfile?.ratingAvg ?? null,
      );
      return { ...event, distanceKm, catalogItemId: row.catalogItemId ?? null };
    }),
  );

  const activeOnly = withDistance.filter((event) => isVisibleInClientEventFeed(event, now));

  /** События, привязанные к снятому/черновому каталогу, не показываем. */
  const visibleForFeed = activeOnly.filter((ev) => {
    if (!ev.catalogItemId) return true;
    const meta = rows.find((r) => r.id === ev.id)?.catalogItem;
    return meta?.status === "PUBLISHED";
  });

  const sortedFlat = filterAndSortEventsByDistance(visibleForFeed, { unlimited, radiusKm });

  const catalogMeta = new Map<
    string,
    {
      id: string;
      title: string;
      body: string;
      category: string | null;
      photoUrl: string | null;
      eventAt: string | null;
      venueAddress: string | null;
      venueLng: number | null;
      venueLat: number | null;
      status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
    }
  >();

  for (const row of rows) {
    if (!row.catalogItem) continue;
    const c = row.catalogItem;
    catalogMeta.set(c.id, {
      id: c.id,
      title: c.title,
      body: c.body,
      category: c.category ?? null,
      photoUrl: c.photoUrl,
      eventAt: c.eventAt?.toISOString() ?? null,
      venueAddress: c.venueAddress,
      venueLat: c.venueLat,
      venueLng: c.venueLng,
      status: c.status,
    });
  }

  let cards = buildClientEventFeedCards(sortedFlat, catalogMeta);

  if (categoryFilter) {
    cards = cards.filter((card) => feedCardCategory(card) === categoryFilter);
  }

  cards = cards.slice(0, 50);

  /** Плоский список для карты / совместимости: по одной точке на карточку каталога + одиночные. */
  const eventsForMap = cards.flatMap((card) => {
    if (card.kind === "single") return [card.event];
    const primary = card.offers[0];
    if (!primary) return [];
    return [
      {
        ...primary,
        id: primary.id,
        title: card.title,
        body: card.body,
        category: card.category,
        photoUrl: card.photoUrl,
        eventAt: card.eventAt,
        venueAddress: card.venueAddress,
        venueLat: card.venueLat,
        venueLng: card.venueLng,
        distanceKm: card.distanceKm,
        priceRub: card.priceFromRub,
        catalogItemId: card.catalogId,
      },
    ];
  });

  return NextResponse.json({
    cards,
    events: eventsForMap,
    meta: {
      originLat: origin.lat,
      originLng: origin.lng,
      radiusKm,
      unlimited,
      category: categoryFilter,
      totalPublished: rows.length,
      shown: cards.length,
    },
  });
}
