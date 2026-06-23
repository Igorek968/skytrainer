import { z } from "zod";

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
  time: z.string().trim().regex(/^\d{1,2}:\d{2}$/, "Время в формате ЧЧ:ММ"),
  maxSeats: z.number().int().min(1).max(10_000).optional().nullable(),
  priceRub: priceRubField,
});

export const createInstructorEventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(200),
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
});

export const updateInstructorEventSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(200).optional(),
  eventAt: z.string().max(40).optional().nullable(),
  orderId: z.string().cuid().optional().nullable(),
  priceRub: priceRubField,
  maxRegistrations: maxRegistrationsField,
});

export const adminEventReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectNote: z.string().trim().max(2000).optional(),
});
