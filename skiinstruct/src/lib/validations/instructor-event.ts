import { z } from "zod";

import { requiredEventCategorySchema } from "@/lib/event-category";

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

const eventSlotInputSchema = z.object({
  id: z.string().cuid().optional(),
  /** YYYY-MM-DD — день этого выхода */
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
    .optional()
    .nullable(),
  time: z.string().trim().regex(/^\d{1,2}:\d{2}$/, "Время в формате ЧЧ:ММ"),
  /** Название выхода / дня */
  title: z.string().trim().max(80).optional().nullable(),
  maxSeats: z.number().int().min(1).max(10_000).optional().nullable(),
  priceRub: priceRubField,
});

const venueCoordField = z.number().optional().nullable();

export const createInstructorEventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  /** Категория / направление из каталога активностей. */
  category: requiredEventCategorySchema,
  /** День мероприятия YYYY-MM-DD (для слотов) или ISO datetime (legacy) */
  eventDay: z.string().max(40).optional().nullable(),
  eventAt: z.string().max(40).optional().nullable(),
  orderId: z.string().cuid().optional().nullable(),
  eventId: z.string().cuid().optional().nullable(),
  /** Скопировать обложку с другого своего мероприятия при создании нового. */
  copyPhotoFromEventId: z.string().cuid().optional().nullable(),
  priceRub: priceRubField,
  maxRegistrations: maxRegistrationsField,
  slots: z.array(eventSlotInputSchema).optional(),
  venueAddress: z.string().trim().max(500).optional().nullable(),
  venueLat: venueCoordField,
  venueLng: venueCoordField,
  /** Авторазмещение на каждый день (применяется после публикации). */
  repeatDaily: z.boolean().optional(),
});

export const updateInstructorEventSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(1000).optional(),
  category: requiredEventCategorySchema.optional(),
  eventAt: z.string().max(40).optional().nullable(),
  orderId: z.string().cuid().optional().nullable(),
  priceRub: priceRubField,
  maxRegistrations: maxRegistrationsField,
});

/** Полное редактирование мероприятия администратором (в т.ч. опубликованных). */
export const adminUpdateInstructorEventSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(1000).optional(),
  category: requiredEventCategorySchema.optional(),
  eventAt: z.string().max(40).optional().nullable(),
  eventDay: z.string().max(40).optional().nullable(),
  orderId: z.string().cuid().optional().nullable(),
  priceRub: priceRubField,
  maxRegistrations: maxRegistrationsField,
  photoUrl: z.string().trim().max(2000).optional().nullable(),
  venueAddress: z.string().trim().max(500).optional().nullable(),
  venueLat: venueCoordField,
  venueLng: venueCoordField,
  slots: z.array(eventSlotInputSchema).optional(),
  repeatDaily: z.boolean().optional(),
  /** false — после правок снять с публикации в DRAFT; по умолчанию статус не трогаем. */
  keepPublished: z.boolean().optional(),
});

export const adminEventReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectNote: z.string().trim().max(2000).optional(),
});
