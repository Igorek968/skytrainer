import type { Prisma } from "@prisma/client";
import {
  emptyEventReviewsSummary,
  reviewAuthorLabel,
  summarizeEventReviews,
  type EventReviewDTO,
  type EventReviewsSummary,
} from "@/lib/event-reviews";
import { prisma } from "@/lib/prisma";

type ReviewRow = {
  id: string;
  eventId: string;
  clientRating: number | null;
  clientReview: string | null;
  updatedAt: Date;
  client: { name: string | null };
  event: { catalogItemId: string | null };
};

function toDto(row: ReviewRow): EventReviewDTO {
  return {
    id: row.id,
    rating: row.clientRating ?? 0,
    text: row.clientReview,
    authorName: reviewAuthorLabel(row.client.name),
    createdAt: row.updatedAt.toISOString(),
  };
}

async function findPaidReviews(where: {
  eventId?: string;
  catalogItemId?: string;
  eventIds?: string[];
  catalogIds?: string[];
}): Promise<ReviewRow[]> {
  const or: Prisma.EventRegistrationWhereInput[] = [];
  if (where.eventId) or.push({ eventId: where.eventId });
  if (where.catalogItemId) or.push({ event: { catalogItemId: where.catalogItemId } });
  if (where.eventIds?.length) or.push({ eventId: { in: where.eventIds } });
  if (where.catalogIds?.length) or.push({ event: { catalogItemId: { in: where.catalogIds } } });
  if (!or.length) return [];

  return prisma.eventRegistration.findMany({
    where: {
      status: "PAID",
      clientRating: { not: null },
      OR: or,
    },
    select: {
      id: true,
      eventId: true,
      clientRating: true,
      clientReview: true,
      updatedAt: true,
      client: { select: { name: true } },
      event: { select: { catalogItemId: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 400,
  });
}

export async function loadEventReviewsList(params: {
  eventId?: string;
  catalogId?: string;
}): Promise<EventReviewDTO[]> {
  const rows = await findPaidReviews({
    eventId: params.eventId,
    catalogItemId: params.catalogId,
  });
  return rows
    .filter((r) => r.clientRating != null)
    .map(toDto)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function loadEventReviewsSummary(params: {
  eventId?: string;
  catalogId?: string;
}): Promise<EventReviewsSummary> {
  const list = await loadEventReviewsList(params);
  return summarizeEventReviews(list);
}

export async function loadEventReviewsForFeed(params: {
  eventIds: string[];
  catalogIds: string[];
}): Promise<{
  byEventId: Map<string, EventReviewsSummary>;
  byCatalogId: Map<string, EventReviewsSummary>;
}> {
  const byEventId = new Map<string, EventReviewsSummary>();
  const byCatalogId = new Map<string, EventReviewsSummary>();
  const rows = await findPaidReviews({
    eventIds: params.eventIds,
    catalogIds: params.catalogIds,
  });

  const eventBuckets = new Map<string, EventReviewDTO[]>();
  const catalogBuckets = new Map<string, EventReviewDTO[]>();
  for (const row of rows) {
    if (row.clientRating == null) continue;
    const dto = toDto(row);
    const evList = eventBuckets.get(row.eventId) ?? [];
    evList.push(dto);
    eventBuckets.set(row.eventId, evList);
    const catalogId = row.event.catalogItemId;
    if (catalogId) {
      const cList = catalogBuckets.get(catalogId) ?? [];
      cList.push(dto);
      catalogBuckets.set(catalogId, cList);
    }
  }

  for (const id of params.eventIds) {
    byEventId.set(id, summarizeEventReviews(eventBuckets.get(id) ?? []));
  }
  for (const id of params.catalogIds) {
    byCatalogId.set(id, summarizeEventReviews(catalogBuckets.get(id) ?? []));
  }
  return { byEventId, byCatalogId };
}

export function reviewsOrEmpty(summary: EventReviewsSummary | undefined): EventReviewsSummary {
  return summary ?? emptyEventReviewsSummary();
}
