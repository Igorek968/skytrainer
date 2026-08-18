import type { EventCatalogKind } from "@prisma/client";

export type CatalogKind = EventCatalogKind;

export function catalogKindLabel(kind: CatalogKind | string | null | undefined): string {
  switch (kind) {
    case "VENUE":
      return "Площадка";
    case "EVENT":
    default:
      return "Событие";
  }
}

export function catalogKindHint(kind: CatalogKind | string | null | undefined): string {
  if (kind === "VENUE") {
    return "Площадка (корты, база): видна на карте, инструкторы присоединяются со своими условиями. Аренда места не продаётся.";
  }
  return "Событие: одна карточка, несколько инструкторов с предложениями.";
}

/** Для площадки без аренды по умолчанию включаем listingOnly. */
export function defaultListingOnlyForKind(kind: CatalogKind | string | null | undefined): boolean {
  return kind === "VENUE";
}
