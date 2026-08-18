import type { EventRegistration, InstructorEvent, EventSlot } from "@prisma/client";

import { isInstructorEventCompleted } from "@/lib/instructor-events";
import {
  EVENT_CANCEL_FULL_REFUND_HOURS,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
} from "@/lib/legal-config";
import { hoursUntilLesson } from "@/lib/lesson-schedule";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  applyInstructorEventRegistrationPenalty,
  shouldChargeInstructorEventPenalty,
} from "@/lib/services/instructor-penalty";
import { createYooKassaRefund, isYooKassaConfigured } from "@/lib/yookassa";

export type EventRegistrationCancelQuote = {
  canCancel: boolean;
  refundPercent: number;
  refundAmount: number;
  reason: string;
};

type RegWithTiming = Pick<EventRegistration, "status" | "amountRub" | "paidAt"> & {
  instructorNoShowRefundClaimedAt?: Date | null;
  event: Pick<InstructorEvent, "eventAt">;
  slot?: Pick<EventSlot, "startsAt"> | null;
};

export function getEventRegistrationStartAt(
  reg: Pick<RegWithTiming, "event" | "slot">,
): Date | null {
  return reg.slot?.startsAt ?? reg.event.eventAt ?? null;
}

export function computeEventRegistrationCancelQuote(
  reg: RegWithTiming,
): EventRegistrationCancelQuote {
  const effectiveAt = getEventRegistrationStartAt(reg);

  if (reg.status === "CANCELLED") {
    return {
      canCancel: false,
      refundPercent: 0,
      refundAmount: 0,
      reason: "Заявка уже отменена",
    };
  }

  if (isInstructorEventCompleted(effectiveAt)) {
    return {
      canCancel: false,
      refundPercent: 0,
      refundAmount: 0,
      reason: "Событие уже прошло — отмена недоступна",
    };
  }

  if (reg.status === "PENDING_PAYMENT") {
    return {
      canCancel: true,
      refundPercent: 0,
      refundAmount: 0,
      reason: "Оплата не завершена — заявка будет отменена",
    };
  }

  if (reg.status === "PAID") {
    const total = Number(reg.amountRub);
    if (total <= 0) {
      return {
        canCancel: true,
        refundPercent: 0,
        refundAmount: 0,
        reason: "Бесплатная запись будет отменена",
      };
    }

    if (!effectiveAt) {
      return {
        canCancel: true,
        refundPercent: 100,
        refundAmount: total,
        reason: "Полный возврат при отмене до начала события",
      };
    }
    const hours = hoursUntilLesson(effectiveAt, new Date());
    if (hours < EVENT_CANCEL_FULL_REFUND_HOURS) {
      return {
        canCancel: false,
        refundPercent: 0,
        refundAmount: 0,
        reason: `Менее ${EVENT_CANCEL_FULL_REFUND_HOURS} ч до события — отмена без возврата`,
      };
    }

    return {
      canCancel: true,
      refundPercent: 100,
      refundAmount: total,
      reason: `За ${EVENT_CANCEL_FULL_REFUND_HOURS} ч и более до начала — полный возврат`,
    };
  }

  return {
    canCancel: false,
    refundPercent: 0,
    refundAmount: 0,
    reason: "Отмена недоступна",
  };
}

/** Отмена записи инструктором: полный возврат клиенту при оплате. */
export function computeInstructorEventRegistrationCancelQuote(
  reg: RegWithTiming,
): EventRegistrationCancelQuote {
  if (reg.status === "CANCELLED") {
    return {
      canCancel: false,
      refundPercent: 0,
      refundAmount: 0,
      reason: "Заявка уже отменена",
    };
  }

  const effectiveAt = getEventRegistrationStartAt(reg);
  if (isInstructorEventCompleted(effectiveAt)) {
    return {
      canCancel: false,
      refundPercent: 0,
      refundAmount: 0,
      reason: "Событие уже прошло",
    };
  }

  if (reg.status === "PENDING_PAYMENT") {
    return {
      canCancel: true,
      refundPercent: 0,
      refundAmount: 0,
      reason: "Неоплаченная запись будет отменена",
    };
  }

  if (reg.status === "PAID") {
    const total = Number(reg.amountRub);
    return {
      canCancel: true,
      refundPercent: total > 0 ? 100 : 0,
      refundAmount: total > 0 ? total : 0,
      reason:
        total > 0
          ? "Отмена инструктором — полный возврат клиенту"
          : "Бесплатная запись будет отменена",
    };
  }

  return {
    canCancel: false,
    refundPercent: 0,
    refundAmount: 0,
    reason: "Отмена недоступна",
  };
}

export function canClaimEventInstructorNoShowRefund(
  reg: RegWithTiming,
  now = new Date(),
): boolean {
  if (reg.status !== "PAID") return false;
  if (reg.instructorNoShowRefundClaimedAt) return false;
  const effectiveAt = getEventRegistrationStartAt(reg);
  if (!effectiveAt) return false;
  return effectiveAt.getTime() <= now.getTime();
}

async function executeRegistrationRefund(
  reg: Pick<
    EventRegistration,
    "stripePaymentIntentId" | "yookassaPaymentId" | "status" | "amountRub"
  >,
  refundAmount: number,
): Promise<void> {
  if (reg.status !== "PAID" || refundAmount <= 0) return;

  const yooId = reg.yookassaPaymentId?.trim();
  if (yooId) {
    if (!isYooKassaConfigured() && !yooId.startsWith("mock_yoo_")) {
      throw new Error("ЮKassa не настроена для возврата");
    }
    await createYooKassaRefund(yooId, refundAmount);
    return;
  }

  const pi = reg.stripePaymentIntentId;
  if (!pi) return;
  if (pi.startsWith("mock_event_") || pi.startsWith("mock_pi_")) return;

  const stripe = getStripe();
  await stripe.refunds.create({
    payment_intent: pi,
    amount: Math.round(refundAmount * 100),
  });
}

async function applyRegistrationCancelByClient(
  reg: EventRegistration & { event: Pick<InstructorEvent, "eventAt">; slot?: Pick<EventSlot, "startsAt"> | null },
): Promise<EventRegistrationCancelQuote & { registrationId: string }> {
  const quote = computeEventRegistrationCancelQuote(reg);
  if (!quote.canCancel) throw new Error(quote.reason);

  if (quote.refundAmount > 0) {
    await executeRegistrationRefund(reg, quote.refundAmount);
  }

  await prisma.eventRegistration.update({
    where: { id: reg.id },
    data: {
      status: "CANCELLED",
      stripeCheckoutSessionId: null,
    },
  });

  return { ...quote, registrationId: reg.id };
}

async function applyRegistrationCancelByInstructor(
  reg: EventRegistration & {
    event: Pick<InstructorEvent, "eventAt" | "instructorId">;
    slot?: Pick<EventSlot, "startsAt"> | null;
  },
): Promise<EventRegistrationCancelQuote & { registrationId: string; penaltyAmountRub?: number }> {
  const quote = computeInstructorEventRegistrationCancelQuote(reg);
  if (!quote.canCancel) throw new Error(quote.reason);

  if (quote.refundAmount > 0) {
    await executeRegistrationRefund(reg, quote.refundAmount);
  }

  const wasPaid = reg.status === "PAID";
  const effectiveAt = getEventRegistrationStartAt(reg);
  const baseAmountRub = Number(reg.amountRub);

  await prisma.eventRegistration.update({
    where: { id: reg.id },
    data: {
      status: "CANCELLED",
      stripeCheckoutSessionId: null,
    },
  });

  let penaltyAmountRub = 0;
  if (baseAmountRub > 0 && wasPaid && shouldChargeInstructorEventPenalty(effectiveAt)) {
    penaltyAmountRub = await applyInstructorEventRegistrationPenalty({
      instructorId: reg.event.instructorId,
      eventRegistrationId: reg.id,
      baseAmountRub,
      reason: `Поздняя отмена события инструктором (менее ${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч) — штраф ${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%`,
    });
  }

  return { ...quote, registrationId: reg.id, penaltyAmountRub };
}

export async function cancelEventRegistration(params: {
  registrationId: string;
  clientId: string;
}): Promise<EventRegistrationCancelQuote & { registrationId: string }> {
  const reg = await prisma.eventRegistration.findFirst({
    where: { id: params.registrationId, clientId: params.clientId },
    include: {
      event: { select: { eventAt: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!reg) throw new Error("NOT_FOUND");
  return applyRegistrationCancelByClient(reg);
}

export async function cancelEventRegistrationByInstructor(params: {
  registrationId: string;
  instructorId: string;
}): Promise<EventRegistrationCancelQuote & { registrationId: string; penaltyAmountRub?: number }> {
  const reg = await prisma.eventRegistration.findFirst({
    where: { id: params.registrationId, event: { instructorId: params.instructorId } },
    include: {
      event: { select: { eventAt: true, instructorId: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!reg) throw new Error("NOT_FOUND");
  return applyRegistrationCancelByInstructor(reg);
}

export async function claimEventInstructorNoShowRefund(params: {
  registrationId: string;
  clientId: string;
}): Promise<EventRegistrationCancelQuote & { registrationId: string; penaltyAmountRub?: number }> {
  const reg = await prisma.eventRegistration.findFirst({
    where: { id: params.registrationId, clientId: params.clientId },
    include: {
      event: { select: { eventAt: true, instructorId: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!reg) throw new Error("NOT_FOUND");

  if (!canClaimEventInstructorNoShowRefund(reg)) {
    throw new Error("Возврат за неявку инструктора сейчас недоступен для этой записи");
  }

  const total = Number(reg.amountRub);
  if (total <= 0) {
    throw new Error("Для бесплатной записи возврат не требуется");
  }

  await executeRegistrationRefund(reg, total);

  await prisma.eventRegistration.update({
    where: { id: reg.id },
    data: {
      status: "CANCELLED",
      instructorNoShowRefundClaimedAt: new Date(),
      stripeCheckoutSessionId: null,
    },
  });

  const penaltyAmountRub = await applyInstructorEventRegistrationPenalty({
    instructorId: reg.event.instructorId,
    eventRegistrationId: reg.id,
    baseAmountRub: total,
    reason: `Неявка инструктора на событие — штраф ${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%`,
  });

  return {
    registrationId: reg.id,
    canCancel: true,
    refundPercent: 100,
    refundAmount: total,
    reason: `Неявка инструктора — полный возврат ${total} ₽`,
    penaltyAmountRub,
  };
}
