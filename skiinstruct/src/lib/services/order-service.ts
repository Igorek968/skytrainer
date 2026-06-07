import type { OrderStatus, Prisma } from "@prisma/client";

import {
  incrementOfferLessonsOnOrderComplete,
  parseDisciplineFromOrderNotes,
} from "@/lib/instructor-specialization-offers";
import { computePayoutEligibleAt } from "@/lib/services/order-payout";
import { maybeAwardReferralReward } from "@/lib/services/referral";
import { prisma } from "@/lib/prisma";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CANCELLED"],
  AWAITING_PAYMENT: ["CANCELLED"],
  PENDING_INSTRUCTOR: ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"],
  ACCEPTED: ["INSTRUCTOR_EN_ROUTE", "CANCELLED"],
  INSTRUCTOR_EN_ROUTE: ["LESSON_STARTED", "CANCELLED"],
  LESSON_STARTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
  EXPIRED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

type TransitionParams = {
  orderId: string;
  actorUserId: string;
  to: OrderStatus;
  extra?: Prisma.OrderUpdateInput;
};

/**
 * Atomic order status update with validation to reduce race conditions.
 */
export async function transitionOrderStatus(params: TransitionParams) {
  const { orderId, actorUserId, to, extra } = params;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new Error("ORDER_NOT_FOUND");

    if (to === "ACCEPTED" || to === "REJECTED") {
      if (order.instructorId !== actorUserId) throw new Error("FORBIDDEN");
    }
    if (to === "INSTRUCTOR_EN_ROUTE" || to === "LESSON_STARTED" || to === "COMPLETED") {
      if (order.instructorId !== actorUserId) throw new Error("FORBIDDEN");
    }
    if (to === "CANCELLED") {
      const allowed =
        order.clientId === actorUserId ||
        order.instructorId === actorUserId ||
        false;
      if (!allowed) throw new Error("FORBIDDEN");
    }
    if (!canTransition(order.status, to)) {
      throw new Error("INVALID_TRANSITION");
    }

    const now = new Date();
    const data: Prisma.OrderUpdateInput = {
      status: to,
      ...extra,
    };

    if (to === "ACCEPTED") {
      data.acceptedAt = now;
      data.pendingExpiresAt = null;
    }
    if (to === "LESSON_STARTED") {
      data.lessonStartedAt = now;
      data.lessonEndReminderSentAt = null;
    }
    if (to === "COMPLETED") {
      data.lessonEndedAt = now;
      data.instructorPayoutReleasedAt = now;
      data.payoutEligibleAt = computePayoutEligibleAt(now);
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data,
    });

    if (to === "COMPLETED") {
      if (updated.instructorId) {
        const discipline =
          updated.disciplineLabel ?? parseDisciplineFromOrderNotes(updated.notes);
        await incrementOfferLessonsOnOrderComplete(updated.instructorId, discipline);
      }
      if (updated.paymentStatus === "PAID") {
        await maybeAwardReferralReward(updated.id);
      }
    }

    return updated;
  });
}
