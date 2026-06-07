import type { Order, OrderCancelledBy, Prisma } from "@prisma/client";

import {
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
} from "@/lib/legal-config";
import { getLessonStartAt, hoursUntilLesson } from "@/lib/lesson-schedule";
import { prisma } from "@/lib/prisma";

export function computeInstructorNoShowPenaltyRub(baseAmountRub: number): number {
  if (baseAmountRub <= 0) return 0;
  return Math.round(((baseAmountRub * INSTRUCTOR_NO_SHOW_PENALTY_PERCENT) / 100) * 100) / 100;
}

/** Поздняя отмена или неявка инструктора на занятие. */
export function shouldChargeInstructorLessonPenalty(params: {
  cancelledBy: OrderCancelledBy;
  order: Pick<Order, "requestedStartDate" | "acceptedAt">;
  now?: Date;
}): boolean {
  if (params.cancelledBy !== "INSTRUCTOR") return false;
  const lessonStart = getLessonStartAt(params.order);
  if (!lessonStart) return true;
  const hours = hoursUntilLesson(lessonStart, params.now ?? new Date());
  return hours < INSTRUCTOR_CANCEL_NOTICE_HOURS;
}

export function shouldChargeInstructorEventPenalty(effectiveStartAt: Date | null, now = new Date()): boolean {
  if (!effectiveStartAt) return true;
  const hours = hoursUntilLesson(effectiveStartAt, now);
  return hours < INSTRUCTOR_CANCEL_NOTICE_HOURS;
}

export async function getInstructorPenaltyBalanceRub(instructorId: string): Promise<number> {
  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: instructorId },
    select: { platformPenaltyBalanceRub: true },
  });
  return Number(profile?.platformPenaltyBalanceRub ?? 0);
}

export async function recordInstructorPlatformPenalty(
  params: {
    instructorId: string;
    baseAmountRub: number;
    reason: string;
    orderId?: string;
    eventRegistrationId?: string;
  },
  tx: Prisma.TransactionClient = prisma,
): Promise<{ penaltyAmountRub: number; skipped: boolean }> {
  const penaltyAmountRub = computeInstructorNoShowPenaltyRub(params.baseAmountRub);
  if (penaltyAmountRub <= 0) {
    return { penaltyAmountRub: 0, skipped: true };
  }

  if (params.orderId) {
    const existing = await tx.order.findUnique({
      where: { id: params.orderId },
      select: { instructorPenaltyAppliedAt: true },
    });
    if (existing?.instructorPenaltyAppliedAt) {
      return { penaltyAmountRub: 0, skipped: true };
    }
  }

  if (params.eventRegistrationId) {
    const existing = await tx.eventRegistration.findUnique({
      where: { id: params.eventRegistrationId },
      select: { instructorPenaltyAppliedAt: true },
    });
    if (existing?.instructorPenaltyAppliedAt) {
      return { penaltyAmountRub: 0, skipped: true };
    }
  }

  const now = new Date();
  await tx.instructorPlatformPenalty.create({
    data: {
      instructorId: params.instructorId,
      orderId: params.orderId,
      eventRegistrationId: params.eventRegistrationId,
      baseAmountRub: params.baseAmountRub.toFixed(2),
      penaltyPercent: INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
      amountRub: penaltyAmountRub.toFixed(2),
      reason: params.reason,
    },
  });

  await tx.instructorProfile.update({
    where: { userId: params.instructorId },
    data: {
      platformPenaltyBalanceRub: { increment: penaltyAmountRub },
    },
  });

  if (params.orderId) {
    await tx.order.update({
      where: { id: params.orderId },
      data: {
        instructorPenaltyAmount: penaltyAmountRub.toFixed(2),
        instructorPenaltyAppliedAt: now,
      },
    });
  }

  if (params.eventRegistrationId) {
    await tx.eventRegistration.update({
      where: { id: params.eventRegistrationId },
      data: {
        instructorPenaltyAmount: penaltyAmountRub.toFixed(2),
        instructorPenaltyAppliedAt: now,
      },
    });
  }

  return { penaltyAmountRub, skipped: false };
}

export async function applyInstructorLessonPenalty(params: {
  instructorId: string;
  orderId: string;
  baseAmountRub: number;
  reason: string;
}): Promise<number> {
  const { penaltyAmountRub } = await recordInstructorPlatformPenalty(params);
  return penaltyAmountRub;
}

export async function applyInstructorEventRegistrationPenalty(params: {
  instructorId: string;
  eventRegistrationId: string;
  baseAmountRub: number;
  reason: string;
}): Promise<number> {
  const { penaltyAmountRub } = await recordInstructorPlatformPenalty(params);
  return penaltyAmountRub;
}

export function netPayoutAfterPenalties(grossRub: number, penaltyBalanceRub: number): {
  netRub: number;
  penaltyDeductedRub: number;
} {
  const penaltyDeductedRub = Math.min(Math.max(0, grossRub), Math.max(0, penaltyBalanceRub));
  const netRub = Math.max(0, grossRub - penaltyDeductedRub);
  return { netRub, penaltyDeductedRub };
}
