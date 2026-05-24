import type { EventRegistration, InstructorEvent } from "@prisma/client";

import { isInstructorEventCompleted } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export type EventRegistrationCancelQuote = {
  canCancel: boolean;
  refundPercent: number;
  refundAmount: number;
  reason: string;
};

export function computeEventRegistrationCancelQuote(
  reg: Pick<EventRegistration, "status" | "amountRub" | "paidAt"> & {
    event: Pick<InstructorEvent, "eventAt">;
  },
): EventRegistrationCancelQuote {
  if (reg.status === "CANCELLED") {
    return {
      canCancel: false,
      refundPercent: 0,
      refundAmount: 0,
      reason: "Заявка уже отменена",
    };
  }

  if (isInstructorEventCompleted(reg.event.eventAt)) {
    return {
      canCancel: false,
      refundPercent: 0,
      refundAmount: 0,
      reason: "Мероприятие уже прошло — отмена недоступна",
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
    return {
      canCancel: true,
      refundPercent: 100,
      refundAmount: total,
      reason: "Полный возврат при отмене до начала мероприятия",
    };
  }

  return {
    canCancel: false,
    refundPercent: 0,
    refundAmount: 0,
    reason: "Отмена недоступна",
  };
}

async function executeRegistrationRefund(
  reg: Pick<EventRegistration, "stripePaymentIntentId" | "status" | "amountRub">,
  refundAmount: number,
): Promise<void> {
  if (reg.status !== "PAID" || refundAmount <= 0) return;
  const pi = reg.stripePaymentIntentId;
  if (!pi) return;
  if (pi.startsWith("mock_event_") || pi.startsWith("mock_pi_")) return;

  const stripe = getStripe();
  await stripe.refunds.create({
    payment_intent: pi,
    amount: Math.round(refundAmount * 100),
  });
}

async function applyRegistrationCancel(
  reg: EventRegistration & { event: Pick<InstructorEvent, "eventAt"> },
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

export async function cancelEventRegistration(params: {
  registrationId: string;
  clientId: string;
}): Promise<EventRegistrationCancelQuote & { registrationId: string }> {
  const reg = await prisma.eventRegistration.findFirst({
    where: { id: params.registrationId, clientId: params.clientId },
    include: { event: { select: { eventAt: true } } },
  });
  if (!reg) throw new Error("NOT_FOUND");
  return applyRegistrationCancel(reg);
}

export async function cancelEventRegistrationByInstructor(params: {
  registrationId: string;
  instructorId: string;
}): Promise<EventRegistrationCancelQuote & { registrationId: string }> {
  const reg = await prisma.eventRegistration.findFirst({
    where: { id: params.registrationId, event: { instructorId: params.instructorId } },
    include: { event: { select: { eventAt: true, instructorId: true } } },
  });
  if (!reg) throw new Error("NOT_FOUND");
  return applyRegistrationCancel(reg);
}
