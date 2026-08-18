import { z } from "zod";

import { requiredEventCategorySchema } from "@/lib/event-category";
import { MAP_CITY_CENTERS } from "@/lib/map-city-centers";

const venueCoordField = z.number().optional().nullable();
const citySlugField = z
  .string()
  .trim()
  .refine((s) => MAP_CITY_CENTERS.some((c) => c.slug === s), "Неизвестный город")
  .optional()
  .nullable();

export const createEventCatalogSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  category: requiredEventCategorySchema,
  /** EVENT — событие; VENUE — площадка (корты). */
  kind: z.enum(["EVENT", "VENUE"]).optional().default("EVENT"),
  /** Витрина без аренды площадки (для VENUE обычно true). */
  listingOnly: z.boolean().optional(),
  photoUrl: z.string().trim().max(500).optional().nullable(),
  eventAt: z.string().max(40).optional().nullable(),
  venueAddress: z.string().trim().max(500).optional().nullable(),
  venueLat: venueCoordField,
  venueLng: venueCoordField,
  citySlug: citySlugField,
  /** Сразу привязать опубликованные события инструкторов. */
  eventIds: z.array(z.string().cuid()).max(50).optional(),
  /** Создать и сразу опубликовать. */
  publish: z.boolean().optional(),
});

export const updateEventCatalogSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(2000).optional(),
  category: requiredEventCategorySchema.optional(),
  kind: z.enum(["EVENT", "VENUE"]).optional(),
  listingOnly: z.boolean().optional(),
  photoUrl: z.string().trim().max(500).optional().nullable(),
  eventAt: z.string().max(40).optional().nullable(),
  venueAddress: z.string().trim().max(500).optional().nullable(),
  venueLat: venueCoordField,
  venueLng: venueCoordField,
  citySlug: citySlugField,
});

export const attachCatalogEventsSchema = z.object({
  eventIds: z.array(z.string().cuid()).min(1).max(50),
});

export const catalogStatusActionSchema = z.object({
  action: z.enum(["publish", "unpublish", "archive"]),
});

const priceRubField = z
  .number()
  .int()
  .min(0)
  .max(500_000)
  .optional()
  .nullable();

const maxRegistrationsField = z
  .number()
  .int()
  .min(1)
  .max(10_000)
  .optional()
  .nullable();

/** Заявка инструктора на участие в карточке каталога (своя цена + сервис). */
export const joinEventCatalogSchema = z.object({
  /** Индивидуальный сервис / условия — показывается клиенту под именем инструктора. */
  serviceNote: z.string().trim().min(1).max(1000),
  priceRub: priceRubField,
  maxRegistrations: maxRegistrationsField,
  /** Если у карточки нет даты — обязательна; иначе можно оставить дату каталога. */
  eventAt: z.string().max(40).optional().nullable(),
});

export const updateCatalogOfferSchema = z.object({
  serviceNote: z.string().trim().min(1).max(1000).optional(),
  priceRub: priceRubField,
  maxRegistrations: maxRegistrationsField,
  eventAt: z.string().max(40).optional().nullable(),
});
