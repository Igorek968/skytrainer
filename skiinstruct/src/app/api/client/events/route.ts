import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveOptionalClientUserId } from "@/lib/api-session";
import {
  CLIENT_EVENTS_RADIUS_KM,
  filterAndSortEventsByDistance,
  instructorEventDistanceKm,
  resolveClientEventsOrigin,
} from "@/lib/client-events-geo";
import { buildClientEventFeedCards, feedCardCategory, feedCardDistanceKm } from "@/lib/event-catalog";
import { loadEventReviewsForFeed, reviewsOrEmpty } from "@/lib/services/event-reviews";
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
          nickname: true,
          profileSlug: true,
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
          kind: true,
          listingOnly: true,
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

  const venueCatalogRows = await prisma.eventCatalogItem.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ kind: "VENUE" }, { listingOnly: true }],
    },
    take: 80,
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      kind: true,
      listingOnly: true,
      photoUrl: true,
      eventAt: true,
      venueAddress: true,
      venueLat: true,
      venueLng: true,
      status: true,
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
      event.instructorProfileSlug = row.instructor.profileSlug;
      event.instructorNickname = row.instructor.nickname;
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
      kind?: "EVENT" | "VENUE";
      listingOnly?: boolean;
      photoUrl: string | null;
      eventAt: string | null;
      venueAddress: string | null;
      venueLng: number | null;
      venueLat: number | null;
      status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
    }
  >();

  for (const row of venueCatalogRows) {
    catalogMeta.set(row.id, {
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category ?? null,
      kind: row.kind === "VENUE" ? "VENUE" : "EVENT",
      listingOnly: Boolean(row.listingOnly) || row.kind === "VENUE",
      photoUrl: row.photoUrl,
      eventAt: row.eventAt?.toISOString() ?? null,
      venueAddress: row.venueAddress,
      venueLat: row.venueLat,
      venueLng: row.venueLng,
      status: row.status,
    });
  }

  for (const row of rows) {
    if (!row.catalogItem) continue;
    const c = row.catalogItem;
    catalogMeta.set(c.id, {
      id: c.id,
      title: c.title,
      body: c.body,
      category: c.category ?? null,
      kind: c.kind === "VENUE" ? "VENUE" : "EVENT",
      listingOnly: Boolean(c.listingOnly) || c.kind === "VENUE",
      photoUrl: c.photoUrl,
      eventAt: c.eventAt?.toISOString() ?? null,
      venueAddress: c.venueAddress,
      venueLat: c.venueLat,
      venueLng: c.venueLng,
      status: c.status,
    });
  }

  let cards = buildClientEventFeedCards(sortedFlat, catalogMeta);

  cards = cards.map((card) => {
    if (card.kind !== "catalog" || card.distanceKm != null) return card;
    if (card.venueLat == null || card.venueLng == null) return card;
    const distanceKm = instructorEventDistanceKm(
      origin.lat,
      origin.lng,
      null,
      null,
      card.venueLat,
      card.venueLng,
    );
    return { ...card, distanceKm };
  });

  if (!unlimited) {
    cards = cards.filter((card) => {
      const d = feedCardDistanceKm(card);
      return d == null || !Number.isFinite(d) || d <= radiusKm;
    });
  }

  if (categoryFilter) {
    cards = cards.filter((card) => feedCardCategory(card) === categoryFilter);
  }

  cards = cards
    .sort((a, b) => (feedCardDistanceKm(a) ?? 99999) - (feedCardDistanceKm(b) ?? 99999))
    .slice(0, 50);

  const eventIds = [
    ...new Set(cards.flatMap((c) => (c.kind === "single" ? [c.event.id] : c.offers.map((o) => o.id)))),
  ];
  const catalogIds = cards.filter((c) => c.kind === "catalog").map((c) => c.catalogId);
  const reviewMaps = await loadEventReviewsForFeed({ eventIds, catalogIds });

  cards = cards.map((card) => {
    if (card.kind === "catalog") {
      const summary = reviewsOrEmpty(reviewMaps.byCatalogId.get(card.catalogId));
      return {
        ...card,
        ratingAvg: summary.ratingAvg,
        reviewCount: summary.reviewCount,
        reviewsPreview: summary.reviewsPreview,
        offers: card.offers.map((o) => {
          const own = reviewsOrEmpty(reviewMaps.byEventId.get(o.id));
          return {
            ...o,
            ratingAvg: own.ratingAvg,
            reviewCount: own.reviewCount,
            reviewsPreview: own.reviewsPreview,
          };
        }),
      };
    }
    const summary = reviewsOrEmpty(reviewMaps.byEventId.get(card.event.id));
    return {
      ...card,
      event: {
        ...card.event,
        ratingAvg: summary.ratingAvg,
        reviewCount: summary.reviewCount,
        reviewsPreview: summary.reviewsPreview,
      },
    };
  });

  /** Плоский список для карты / совместимости: по одной точке на карточку каталога + одиночные. */
  const eventsForMap = cards.flatMap((card) => {
    if (card.kind === "single") return [card.event];
    const primary = card.offers[0];
    if (!primary) {
      // Площадка без инструкторов — пин по координатам карточки
      if (card.venueLat == null || card.venueLng == null) return [];
          return [
        {
          id: `catalog-pin:${card.catalogId}`,
          instructorId: "",
          title: card.title,
          body: card.body,
          category: card.category,
          photoUrl: card.photoUrl,
          eventAt: card.eventAt,
          venueAddress: card.venueAddress,
          venueLat: card.venueLat,
          venueLng: card.venueLng,
          distanceKm: card.distanceKm,
          priceRub: null,
          catalogItemId: card.catalogId,
          moderationStatus: "PUBLISHED" as const,
          isCompleted: false,
          canEdit: false,
          paidRegistrationCount: 0,
          spotsLeft: null,
          registrationOpen: false,
          isFree: true,
          myRegistration: null,
          slots: [],
          hasSlots: false,
          rejectNote: null,
          submittedAt: null,
          publishedAt: null,
          orderId: null,
          maxRegistrations: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        } as unknown as import("@/lib/instructor-events").ClientInstructorEventDTO,
      ];
    }
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
        priceRub: card.listingOnly ? null : card.priceFromRub,
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
