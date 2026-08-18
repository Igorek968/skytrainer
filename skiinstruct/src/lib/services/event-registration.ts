import type { EventRegistrationStatus, InstructorEvent, Prisma } from "@prisma/client";

import {
  isInstructorEventCompleted,
} from "@/lib/instructor-events";
import { PLATFORM_FEE_PERCENT } from "@/lib/legal-config";
import { prisma } from "@/lib/prisma";

import { registrationNeedsAttendanceConfirmation } from "./event-attendance-shared";

export const VISIBLE_ORDER_STATUSES_FOR_EVENTS = [
  "PENDING_INSTRUCTOR",
  "ACCEPTED",
  "INSTRUCTOR_EN_ROUTE",
  "LESSON_STARTED",
  "COMPLETED",
] as const;

export function computeEventPaymentShares(priceRub: number) {
  const amount = Math.max(0, Math.round(priceRub));
  const fee = Math.round((amount * PLATFORM_FEE_PERCENT) / 100);
  const instructorShare = amount - fee;
  return {
    amountRub: amount,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    instructorShareAmount: instructorShare,
  };
}

export function isEventFree(priceRub: number | null | undefined): boolean {
  return priceRub == null || priceRub <= 0;
}

/** Запись: любое опубликованное событие; привязка к заказу — только участникам этого заказа. */
export async function clientCanAccessEvent(
  clientId: string,
  event: Pick<InstructorEvent, "instructorId" | "orderId" | "moderationStatus">,
): Promise<boolean> {
  if (event.moderationStatus !== "PUBLISHED") return false;
  if (!event.orderId) return true;
  const order = await prisma.order.findFirst({
    where: {
      id: event.orderId,
      clientId,
      instructorId: event.instructorId,
      status: { in: [...VISIBLE_ORDER_STATUSES_FOR_EVENTS] },
    },
    select: { id: true },
  });
  return Boolean(order);
}

export async function countActiveRegistrations(eventId: string): Promise<number> {
  return prisma.eventRegistration.count({
    where: { eventId, status: { in: ["PAID", "PENDING_PAYMENT"] } },
  });
}

/** Оплаченные и подтвердившие участие — для выплат инструктору. */
export async function countSettledRegistrations(eventId: string): Promise<number> {
  return prisma.eventRegistration.count({
    where: {
      eventId,
      status: "PAID",
      attendanceConfirmedAt: { not: null },
    },
  });
}

export async function countPaidRegistrations(eventId: string): Promise<number> {
  return countActiveRegistrations(eventId);
}

export async function getEventCapacityState(event: {
  id: string;
  maxRegistrations: number | null;
}) {
  const paidCount = await countPaidRegistrations(event.id);
  const spotsLeft =
    event.maxRegistrations != null
      ? Math.max(0, event.maxRegistrations - paidCount)
      : null;
  const isFull = event.maxRegistrations != null && paidCount >= event.maxRegistrations;
  return { paidCount, spotsLeft, isFull };
}

export function registrationOpenForEvent(
  event: Pick<InstructorEvent, "moderationStatus" | "eventAt">,
  isFull: boolean,
): boolean {
  if (event.moderationStatus !== "PUBLISHED") return false;
  if (isInstructorEventCompleted(event.eventAt)) return false;
  if (isFull) return false;
  return true;
}

export type EventRegistrationSummary = {
  id: string;
  status: EventRegistrationStatus;
  amountRub: number;
  paidAt: string | null;
  attendanceConfirmedAt?: string | null;
  needsAttendanceConfirmation?: boolean;
};

export function serializeEventRegistration(row: {
  id: string;
  status: EventRegistrationStatus;
  amountRub: Prisma.Decimal | number;
  paidAt: Date | null;
  attendanceConfirmedAt?: Date | null;
  eventAt?: Date | null;
}): EventRegistrationSummary {
  const needsAttendanceConfirmation =
    row.eventAt !== undefined
      ? registrationNeedsAttendanceConfirmation(
          { status: row.status, attendanceConfirmedAt: row.attendanceConfirmedAt ?? null },
          row.eventAt,
        )
      : undefined;

  return {
    id: row.id,
    status: row.status,
    amountRub: Number(row.amountRub),
    paidAt: row.paidAt?.toISOString() ?? null,
    attendanceConfirmedAt: row.attendanceConfirmedAt?.toISOString() ?? null,
    needsAttendanceConfirmation,
  };
}
