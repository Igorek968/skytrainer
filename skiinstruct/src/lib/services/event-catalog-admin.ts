import type { EventCatalogItem, InstructorEvent } from "@prisma/client";

import type { EventCatalogItemDTO } from "@/lib/event-catalog";

export function serializeEventCatalogItem(
  row: EventCatalogItem & { events?: Pick<InstructorEvent, "id">[] },
): EventCatalogItemDTO {
  const events = row.events ?? [];
  return {
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
    citySlug: row.citySlug ?? null,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    unpublishedAt: row.unpublishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    offerCount: events.length,
    eventIds: events.map((e) => e.id),
  };
}

export function parseOptionalEventAt(raw: string | null | undefined): Date | null {
  if (raw == null || raw.trim() === "") return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) {
    throw new Error("Некорректная дата мероприятия");
  }
  return d;
}
