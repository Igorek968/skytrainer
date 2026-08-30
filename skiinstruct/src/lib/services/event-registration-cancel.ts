import type { EventRegistration, InstructorEvent, EventSlot } from "@prisma/client";

import { isInstructorEventCompleted } from "@/lib/instructor-events";
import {
  EVENT_CANCEL_FULL_REFUND_HOURS,
  EVENT_FORCE_MAJEURE_REASON_MAX,
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
import { emitAdminAlert } from "@/lib/services/admin-alerts";
import { writeAdminAudit } from "@/lib/services/admin-audit";
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
        canCancel: true,
        refundPercent: 0,
        refundAmount: 0,
        reason: `Менее ${EVENT_CANCEL_FULL_REFUND_HOURS} ч до события — место освободится, оплата не возвращается`,
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
      cancelReason: quote.reason.slice(0, 100),
      cancelledAt: new Date(),
      cancelledBy: "CLIENT",
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
      cancelReason: quote.reason.slice(0, 100),
      cancelledAt: new Date(),
      cancelledBy: "INSTRUCTOR",
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
      cancelReason: `Неявка инструктора — полный возврат`.slice(0, 100),
      cancelledAt: new Date(),
      cancelledBy: "CLIENT_NO_SHOW",
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

export function canForceMajeureCancelEvent(params: {
  forceMajeureAt?: Date | null;
  eventAt: Date | null;
  slotStarts?: Array<Date | null | undefined>;
  now?: Date;
}): boolean {
  if (params.forceMajeureAt) return false;
  const now = params.now ?? new Date();
  const starts = [
    params.eventAt,
    ...(params.slotStarts ?? []).filter((d): d is Date => d instanceof Date),
  ].filter((d): d is Date => d instanceof Date && Number.isFinite(d.getTime()));
  if (!starts.length) return false;
  const earliest = starts.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
  return earliest.getTime() <= now.getTime();
}

/**
 * Форс-мажор после начала события: полный возврат всем активным записям, без штрафа инструктору.
 */
export async function forceMajeureCancelEvent(params: {
  eventId: string;
  instructorId: string;
  reason: string;
}): Promise<{
  cancelledRegistrations: number;
  refundedRub: number;
  reason: string;
}> {
  const reason = params.reason.trim().slice(0, EVENT_FORCE_MAJEURE_REASON_MAX);
  if (reason.length < 3) {
    throw new Error(`Укажите причину форс-мажора (от 3 до ${EVENT_FORCE_MAJEURE_REASON_MAX} символов)`);
  }

  const event = await prisma.instructorEvent.findFirst({
    where: { id: params.eventId, instructorId: params.instructorId },
    include: {
      slots: { select: { startsAt: true } },
      instructor: { select: { name: true, email: true } },
    },
  });
  if (!event) throw new Error("NOT_FOUND");
  if (event.forceMajeureAt) throw new Error("Форс-мажор по этому событию уже оформлен");

  if (
    !canForceMajeureCancelEvent({
      forceMajeureAt: event.forceMajeureAt,
      eventAt: event.eventAt,
      slotStarts: event.slots.map((s) => s.startsAt),
    })
  ) {
    throw new Error("Форс-мажор доступен только после начала события");
  }

  const activeRegs = await prisma.eventRegistration.findMany({
    where: { eventId: event.id, status: { in: ["PAID", "PENDING_PAYMENT"] } },
  });

  let cancelledRegistrations = 0;
  let refundedRub = 0;
  const cancelNote = `Форс-мажор: ${reason}`.slice(0, 100);

  for (const reg of activeRegs) {
    const amount = Number(reg.amountRub);
    if (reg.status === "PAID" && amount > 0) {
      await executeRegistrationRefund(reg, amount);
      refundedRub += amount;
    }
    await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: {
        status: "CANCELLED",
        stripeCheckoutSessionId: null,
        cancelReason: cancelNote,
        cancelledAt: new Date(),
        cancelledBy: "FORCE_MAJEURE",
      },
    });
    cancelledRegistrations += 1;
  }

  await prisma.instructorEvent.update({
    where: { id: event.id },
    data: {
      forceMajeureAt: new Date(),
      forceMajeureReason: reason,
      moderationStatus:
        event.moderationStatus === "DRAFT" || event.moderationStatus === "REJECTED"
          ? event.moderationStatus
          : "ARCHIVED",
    },
  });

  const who = event.instructor.name?.trim() || event.instructor.email;
  void emitAdminAlert({
    category: "ORDERS",
    title: `Форс-мажор · отменено: ${event.title.slice(0, 60)}`,
    body: `${who}: ${reason}. Записей: ${cancelledRegistrations}, возврат ≈ ${Math.round(refundedRub)} ₽.`,
    href: `/admin/pipeline`,
    dedupeKey: `orders:force-majeure:event:${event.id}`,
    entityId: event.id,
  });
  void writeAdminAudit({
    actorId: params.instructorId,
    action: "event.force_majeure",
    entity: "InstructorEvent",
    entityId: event.id,
    summary: `Форс-мажор: ${reason}`,
    meta: {
      cancelledRegistrations,
      refundedRub,
      reason,
    },
  });

  return { cancelledRegistrations, refundedRub, reason };
}
