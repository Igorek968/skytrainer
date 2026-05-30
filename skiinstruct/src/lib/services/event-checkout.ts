import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import { isInstructorEventCompleted } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

import { computeEventPaymentShares } from "./event-registration";

export async function markEventRegistrationPaid(params: {
  registrationId: string;
  stripePaymentIntentId?: string | null;
}) {
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: params.registrationId },
    select: {
      id: true,
      status: true,
      attendanceConfirmedAt: true,
      event: { select: { eventAt: true } },
    },
  });
  if (!reg || reg.status === "PAID") return reg;

  const eventCompleted = isInstructorEventCompleted(reg.event.eventAt);

  return prisma.eventRegistration.update({
    where: { id: params.registrationId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ...(eventCompleted && !reg.attendanceConfirmedAt
        ? { attendanceConfirmedAt: new Date() }
        : {}),
      ...(params.stripePaymentIntentId
        ? { stripePaymentIntentId: params.stripePaymentIntentId }
        : {}),
    },
  });
}

export async function createEventCheckoutUrl(registrationId: string): Promise<string> {
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      event: { select: { id: true, title: true, eventAt: true } },
      client: { select: { id: true } },
    },
  });
  if (!reg) throw new Error("Запись не найдена");
  if (reg.status === "PAID" && reg.paidAt) throw new Error("Уже оплачено");
  if (reg.status === "CANCELLED") throw new Error("Запись отменена");

  const amount = Number(reg.amountRub);
  if (amount <= 0) {
    await markEventRegistrationPaid({ registrationId });
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    return `${origin}/client/registrations/${registrationId}?paid=1`;
  }

  if (!isInstructorEventCompleted(reg.event.eventAt)) {
    throw new Error("Оплата будет доступна после окончания мероприятия");
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

  if (isMockCheckoutEnabled()) {
    const mockIntentId = `mock_event_${registrationId.slice(0, 12)}_${Date.now()}`;
    await markEventRegistrationPaid({
      registrationId,
      stripePaymentIntentId: mockIntentId,
    });
    return `${origin}/client/registrations/${registrationId}?paid=1&mock=1`;
  }

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "rub",
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `SkiInstruct — ${reg.event.title.slice(0, 80)}`,
          },
        },
      },
    ],
    success_url: `${origin}/client/registrations/${registrationId}?paid=1`,
    cancel_url: `${origin}/client/registrations/${registrationId}?paid=0`,
    metadata: {
      eventRegistrationId: registrationId,
      type: "event",
    },
    payment_intent_data: {
      metadata: {
        eventRegistrationId: registrationId,
        type: "event",
      },
    },
  });

  await prisma.eventRegistration.update({
    where: { id: registrationId },
    data: { stripeCheckoutSessionId: checkout.id },
  });

  if (!checkout.url) throw new Error("Не удалось создать ссылку на оплату");
  return checkout.url;
}

export function buildRegistrationAmounts(priceRub: number | null | undefined) {
  if (priceRub == null || priceRub <= 0) {
    return {
      amountRub: 0,
      platformFeePercent: computeEventPaymentShares(0).platformFeePercent,
      instructorShareAmount: 0,
      requiresPayment: false,
    };
  }
  const shares = computeEventPaymentShares(priceRub);
  return {
    ...shares,
    requiresPayment: shares.amountRub > 0,
  };
}
