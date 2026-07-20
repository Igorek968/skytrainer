import type { EventCatalogStatus } from "@prisma/client";

import type { ClientInstructorEventDTO, InstructorEventDTO } from "@/lib/instructor-events";

export type EventCatalogItemDTO = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  photoUrl: string | null;
  eventAt: string | null;
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
  citySlug: string | null;
  status: EventCatalogStatus;
  publishedAt: string | null;
  unpublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  offerCount: number;
  eventIds: string[];
};

/** Своя заявка инструктора на участие в карточке каталога. */
export type InstructorCatalogMyOfferDTO = InstructorEventDTO & {
  serviceNote: string;
  canWithdraw: boolean;
};

/** Карточка каталога для кабинета инструктора (+ статус своей заявки). */
export type InstructorCatalogBrowseItemDTO = EventCatalogItemDTO & {
  publishedOfferCount: number;
  priceFromRub: number | null;
  myOffer: InstructorCatalogMyOfferDTO | null;
};

/** Карточка ленты: каталог (несколько инструкторов) или одиночное мероприятие. */
export type ClientEventFeedCardDTO =
  | {
      kind: "catalog";
      catalogId: string;
      title: string;
      body: string;
      category: string | null;
      photoUrl: string | null;
      eventAt: string | null;
      venueAddress: string | null;
      venueLat: number | null;
      venueLng: number | null;
      distanceKm?: number;
      offerCount: number;
      priceFromRub: number | null;
      offers: ClientInstructorEventDTO[];
    }
  | {
      kind: "single";
      event: ClientInstructorEventDTO;
    };

export function feedCardCategory(card: ClientEventFeedCardDTO): string | null {
  return card.kind === "catalog" ? card.category : card.event.category ?? null;
}

export function catalogStatusLabel(status: EventCatalogStatus): string {
  switch (status) {
    case "DRAFT":
      return "Черновик";
    case "PUBLISHED":
      return "Опубликовано";
    case "UNPUBLISHED":
      return "Снято с публикации";
    case "ARCHIVED":
      return "В архиве";
    default:
      return status;
  }
}

export function feedCardId(card: ClientEventFeedCardDTO): string {
  return card.kind === "catalog" ? `catalog:${card.catalogId}` : `event:${card.event.id}`;
}

export function feedCardTitle(card: ClientEventFeedCardDTO): string {
  return card.kind === "catalog" ? card.title : card.event.title;
}

export function feedCardPhotoUrl(card: ClientEventFeedCardDTO): string | null {
  return card.kind === "catalog" ? card.photoUrl : card.event.photoUrl;
}

export function feedCardDistanceKm(card: ClientEventFeedCardDTO): number | undefined {
  return card.kind === "catalog" ? card.distanceKm : card.event.distanceKm;
}

export function feedCardBadgeValue(card: ClientEventFeedCardDTO): string {
  if (card.kind === "catalog") {
    if (card.distanceKm != null && Number.isFinite(card.distanceKm) && card.distanceKm < 9000) {
      return card.distanceKm.toFixed(1).replace(".", ",");
    }
    if (card.priceFromRub == null || card.priceFromRub <= 0) return String(card.offerCount);
    if (card.priceFromRub < 1000) return String(card.priceFromRub);
    return (card.priceFromRub / 1000).toFixed(1).replace(".", ",");
  }
  const event = card.event;
  if (event.distanceKm != null && Number.isFinite(event.distanceKm) && event.distanceKm < 9000) {
    return event.distanceKm.toFixed(1).replace(".", ",");
  }
  if (event.isFree || event.priceRub == null || event.priceRub <= 0) return "0";
  if (event.priceRub < 1000) return String(event.priceRub);
  return (event.priceRub / 1000).toFixed(1).replace(".", ",");
}

/** Группирует опубликованные события в карточки каталога + одиночные. */
export function buildClientEventFeedCards(
  events: ClientInstructorEventDTO[],
  catalogMeta: Map<
    string,
    {
      id: string;
      title: string;
      body: string;
      category: string | null;
      photoUrl: string | null;
      eventAt: string | null;
      venueAddress: string | null;
      venueLat: number | null;
      venueLng: number | null;
      status: EventCatalogStatus;
    }
  >,
): ClientEventFeedCardDTO[] {
  const byCatalog = new Map<string, ClientInstructorEventDTO[]>();
  const singles: ClientInstructorEventDTO[] = [];

  for (const ev of events) {
    const catalogId = ev.catalogItemId;
    if (!catalogId) {
      singles.push(ev);
      continue;
    }
    const meta = catalogMeta.get(catalogId);
    if (!meta || meta.status !== "PUBLISHED") {
      // Снятый/черновой каталог: не показываем привязанные офферы в ленте.
      continue;
    }
    const list = byCatalog.get(catalogId) ?? [];
    list.push(ev);
    byCatalog.set(catalogId, list);
  }

  const cards: ClientEventFeedCardDTO[] = [];

  for (const [catalogId, offers] of byCatalog) {
    if (!offers.length) continue;
    const meta = catalogMeta.get(catalogId)!;
    const sortedOffers = [...offers].sort((a, b) => {
      const priceA = a.priceRub != null && a.priceRub > 0 ? a.priceRub : Number.POSITIVE_INFINITY;
      const priceB = b.priceRub != null && b.priceRub > 0 ? b.priceRub : Number.POSITIVE_INFINITY;
      if (priceA !== priceB) return priceA - priceB;
      return (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999);
    });
    const prices = sortedOffers
      .map((o) => o.priceRub)
      .filter((p): p is number => p != null && p > 0);
    const priceFromRub = prices.length ? Math.min(...prices) : null;
    const distanceKm = sortedOffers[0]?.distanceKm;
    cards.push({
      kind: "catalog",
      catalogId,
      title: meta.title,
      body: meta.body,
      category:
        meta.category ??
        sortedOffers.find((o) => o.category)?.category ??
        null,
      photoUrl: meta.photoUrl ?? sortedOffers.find((o) => o.photoUrl)?.photoUrl ?? null,
      eventAt: meta.eventAt ?? sortedOffers.find((o) => o.eventAt)?.eventAt ?? null,
      venueAddress: meta.venueAddress ?? sortedOffers.find((o) => o.venueAddress)?.venueAddress ?? null,
      venueLat: meta.venueLat ?? sortedOffers.find((o) => o.venueLat != null)?.venueLat ?? null,
      venueLng: meta.venueLng ?? sortedOffers.find((o) => o.venueLng != null)?.venueLng ?? null,
      distanceKm,
      offerCount: sortedOffers.length,
      priceFromRub,
      offers: sortedOffers,
    });
  }

  for (const ev of singles) {
    cards.push({ kind: "single", event: ev });
  }

  cards.sort((a, b) => (feedCardDistanceKm(a) ?? 99999) - (feedCardDistanceKm(b) ?? 99999));
  return cards;
}
