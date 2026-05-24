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

export const createInstructorEventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
  eventAt: z.string().max(40).optional().nullable(),
  orderId: z.string().cuid().optional().nullable(),
  eventId: z.string().cuid().optional().nullable(),
  priceRub: priceRubField,
  maxRegistrations: maxRegistrationsField,
});

export const updateInstructorEventSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
  eventAt: z.string().max(40).optional().nullable(),
  orderId: z.string().cuid().optional().nullable(),
  priceRub: priceRubField,
  maxRegistrations: maxRegistrationsField,
});

export const adminEventReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectNote: z.string().trim().max(2000).optional(),
});
