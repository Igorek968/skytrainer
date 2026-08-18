import type {
  EventCatalogItem,
  InstructorEvent,
  InstructorEventModerationStatus,
} from "@prisma/client";

import type {
  InstructorCatalogBrowseItemDTO,
  InstructorCatalogMyOfferDTO,
} from "@/lib/event-catalog";
import {
  canEditInstructorEvent,
  serializeInstructorEvent,
} from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { serializeEventCatalogItem } from "@/lib/services/event-catalog-admin";

export type { InstructorCatalogBrowseItemDTO, InstructorCatalogMyOfferDTO };

/** Активная заявка: всё, кроме архива (повторное присоединение после ARCHIVED разрешено). */
export const ACTIVE_CATALOG_OFFER_STATUSES: InstructorEventModerationStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
];

export function canWithdrawCatalogOffer(row: {
  moderationStatus: InstructorEventModerationStatus;
  paidRegistrationCount?: number;
}): boolean {
  if (row.moderationStatus === "ARCHIVED") return false;
  if (row.moderationStatus === "PUBLISHED" && (row.paidRegistrationCount ?? 0) > 0) {
    return false;
  }
  return true;
}

export function serializeMyCatalogOffer(
  row: InstructorEvent,
  paidRegistrationCount = 0,
): InstructorCatalogMyOfferDTO {
  const base = serializeInstructorEvent(row, { paidRegistrationCount });
  return {
    ...base,
    serviceNote: row.body,
    canWithdraw: canWithdrawCatalogOffer({
      moderationStatus: row.moderationStatus,
      paidRegistrationCount,
    }),
  };
}

export async function findActiveCatalogOffer(instructorId: string, catalogItemId: string) {
  return prisma.instructorEvent.findFirst({
    where: {
      instructorId,
      catalogItemId,
      moderationStatus: { in: ACTIVE_CATALOG_OFFER_STATUSES },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function buildCatalogOfferCreateData(input: {
  instructorId: string;
  catalog: EventCatalogItem;
  serviceNote: string;
  priceRub: number | null;
  maxRegistrations: number | null;
  eventAt: Date | null;
  moderationStatus: InstructorEventModerationStatus;
  submittedAt: Date | null;
  publishedAt: Date | null;
}) {
  const { catalog } = input;
  return {
    instructorId: input.instructorId,
    catalogItemId: catalog.id,
    title: catalog.title,
    body: input.serviceNote,
    category: catalog.category,
    photoUrl: catalog.photoUrl,
    eventAt: input.eventAt,
    priceRub: input.priceRub,
    maxRegistrations: input.maxRegistrations,
    venueAddress: catalog.venueAddress,
    venueLat: catalog.venueLat,
    venueLng: catalog.venueLng,
    moderationStatus: input.moderationStatus,
    submittedAt: input.submittedAt,
    publishedAt: input.publishedAt,
    rejectNote: null as string | null,
    repeatDaily: false,
  };
}

export async function listInstructorCatalogBrowse(input: {
  instructorId: string;
  citySlug?: string | null;
  q?: string | null;
}): Promise<InstructorCatalogBrowseItemDTO[]> {
  const q = input.q?.trim();
  const rows = await prisma.eventCatalogItem.findMany({
    where: {
      status: "PUBLISHED",
      ...(input.citySlug ? { citySlug: input.citySlug } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
              { venueAddress: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ eventAt: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: 80,
    include: {
      events: {
        where: {
          OR: [
            { moderationStatus: "PUBLISHED" },
            {
              instructorId: input.instructorId,
              moderationStatus: { in: ACTIVE_CATALOG_OFFER_STATUSES },
            },
          ],
        },
      },
    },
  });

  const myOfferIds = rows.flatMap((r) =>
    r.events.filter((e) => e.instructorId === input.instructorId).map((e) => e.id),
  );
  const paidCounts =
    myOfferIds.length === 0
      ? []
      : await prisma.eventRegistration.groupBy({
          by: ["eventId"],
          where: {
            eventId: { in: myOfferIds },
            status: { in: ["PAID", "PENDING_PAYMENT"] },
          },
          _count: { _all: true },
        });
  const paidByEvent = new Map(paidCounts.map((g) => [g.eventId, g._count._all]));

  return rows.map((row) => {
    const published = row.events.filter((e) => e.moderationStatus === "PUBLISHED");
    const prices = published
      .map((e) => e.priceRub)
      .filter((p): p is number => p != null && p > 0);
    const my = row.events.find((e) => e.instructorId === input.instructorId) ?? null;
    const base = serializeEventCatalogItem({
      ...row,
      events: published.map((e) => ({ id: e.id })),
    });
    return {
      ...base,
      publishedOfferCount: published.length,
      priceFromRub: prices.length ? Math.min(...prices) : null,
      myOffer: my ? serializeMyCatalogOffer(my, paidByEvent.get(my.id) ?? 0) : null,
    };
  });
}

export function resolveCatalogOfferEventAt(
  catalog: Pick<EventCatalogItem, "eventAt">,
  raw: string | null | undefined,
): { ok: true; eventAt: Date | null } | { ok: false; error: string } {
  if (raw != null && String(raw).trim() !== "") {
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) {
      return { ok: false, error: "Некорректная дата события" };
    }
    return { ok: true, eventAt: d };
  }
  if (catalog.eventAt) {
    return { ok: true, eventAt: catalog.eventAt };
  }
  return {
    ok: false,
    error: "Укажите дату и время — у карточки каталога они не заданы",
  };
}

export function assertCanEditCatalogOffer(row: InstructorEvent): string | null {
  if (row.moderationStatus === "PENDING_REVIEW") {
    return "Заявка уже на модерации — дождитесь решения или отзовите её";
  }
  if (row.moderationStatus === "PUBLISHED") {
    return "Опубликованный оффер нельзя менять. Отзовите участие и подайте новую заявку";
  }
  if (row.moderationStatus === "ARCHIVED") {
    return "Участие снято — подайте новую заявку";
  }
  if (!canEditInstructorEvent(row)) {
    return "Эту заявку нельзя изменить";
  }
  return null;
}
