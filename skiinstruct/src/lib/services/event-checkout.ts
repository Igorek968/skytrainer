import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import { isInstructorEventCompleted } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getPublicProductName } from "@/shared/lib/product";
import {
  createYooKassaEventPayment,
  isYooKassaConfigured,
} from "@/lib/yookassa";

import { computeEventPaymentShares } from "./event-registration";

export async function markEventRegistrationPaid(params: {
  registrationId: string;
  stripePaymentIntentId?: string | null;
  yookassaPaymentId?: string | null;
}) {
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: params.registrationId },
    select: {
      id: true,
      status: true,
      attendanceConfirmedAt: true,
      event: { select: { eventAt: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!reg || reg.status === "PAID") return reg;

  const effectiveAt = reg.slot?.startsAt ?? reg.event.eventAt;
  const eventCompleted = isInstructorEventCompleted(effectiveAt);

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
      ...(params.yookassaPaymentId ? { yookassaPaymentId: params.yookassaPaymentId } : {}),
    },
  });
}

export async function createEventCheckoutUrl(
  registrationId: string,
  customerEmail?: string | null,
): Promise<string> {
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      event: { select: { id: true, title: true, eventAt: true } },
      slot: { select: { startsAt: true } },
      client: { select: { id: true, email: true } },
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

  const effectiveAt = reg.slot?.startsAt ?? reg.event.eventAt;
  if (!isInstructorEventCompleted(effectiveAt)) {
    throw new Error("Оплата будет доступна после окончания мероприятия");
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const returnUrl = `${origin}/client/registrations/${registrationId}?paid=1`;

  if (isMockCheckoutEnabled()) {
    const mockIntentId = `mock_event_${registrationId.slice(0, 12)}_${Date.now()}`;
    await markEventRegistrationPaid({
      registrationId,
      stripePaymentIntentId: mockIntentId,
    });
    return `${returnUrl}&mock=1`;
  }

  if (isYooKassaConfigured()) {
    const email = (customerEmail ?? reg.client.email)?.trim();
    if (!email) throw new Error("Укажите email для чека");

    const pay = await createYooKassaEventPayment({
      eventRegistrationId: registrationId,
      amountRub: amount,
      description: `${getPublicProductName()} — ${reg.event.title.slice(0, 80)}`,
      customerEmail: email,
      returnUrl,
    });

    if (!pay.confirmationUrl) throw new Error("ЮKassa не вернула ссылку на оплату");

    await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { yookassaPaymentId: pay.paymentId },
    });

    return pay.confirmationUrl;
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
            name: `${getPublicProductName()} — ${reg.event.title.slice(0, 80)}`,
          },
        },
      },
    ],
    success_url: returnUrl,
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
