import { formatEventPartyRu } from "@/lib/event-party";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getPublicProductName } from "@/shared/lib/product";
import { saveCardFromPaymentMethodPayload } from "@/lib/services/client-yookassa-card";
import {
  createYooKassaEventPayment,
  fetchYooKassaPayment,
  isYooKassaConfigured,
  isYooKassaRecurringEnabled,
} from "@/lib/yookassa";

import { computeEventPaymentShares } from "./event-registration";
import { notifyInstructorOfEventRegistration } from "./event-registration-notify";

async function markOneEventRegistrationPaid(params: {
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
      paidAt: true,
      event: { select: { eventAt: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!reg || reg.status === "PAID") return reg;

  const updated = await prisma.eventRegistration.update({
    where: { id: params.registrationId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ...(params.stripePaymentIntentId
        ? { stripePaymentIntentId: params.stripePaymentIntentId }
        : {}),
      ...(params.yookassaPaymentId ? { yookassaPaymentId: params.yookassaPaymentId } : {}),
    },
  });

  void notifyInstructorOfEventRegistration(updated.id);
  return updated;
}

export async function markEventRegistrationPaid(params: {
  registrationId: string;
  stripePaymentIntentId?: string | null;
  yookassaPaymentId?: string | null;
}) {
  const updated = await markOneEventRegistrationPaid(params);

  if (params.yookassaPaymentId) {
    const siblings = await prisma.eventRegistration.findMany({
      where: {
        yookassaPaymentId: params.yookassaPaymentId,
        id: { not: params.registrationId },
        status: { not: "PAID" },
      },
      select: { id: true },
    });
    for (const s of siblings) {
      await markOneEventRegistrationPaid({
        registrationId: s.id,
        yookassaPaymentId: params.yookassaPaymentId,
        stripePaymentIntentId: params.stripePaymentIntentId,
      });
    }
  }

  return updated;
}

export async function createEventCheckoutUrl(
  registrationIdOrIds: string | string[],
  customerEmail?: string | null,
): Promise<string> {
  const ids = [
    ...new Set(Array.isArray(registrationIdOrIds) ? registrationIdOrIds : [registrationIdOrIds]),
  ];
  const regs = await prisma.eventRegistration.findMany({
    where: { id: { in: ids } },
    include: {
      event: { select: { id: true, title: true, eventAt: true } },
      slot: { select: { startsAt: true, title: true } },
      client: { select: { id: true, email: true } },
    },
  });
  if (!regs.length) throw new Error("Запись не найдена");
  if (regs.length !== ids.length) throw new Error("Не все записи найдены");
  if (regs.some((r) => r.status === "CANCELLED")) throw new Error("Запись отменена");
  const unpaid = regs.filter((r) => !(r.status === "PAID" && r.paidAt));
  if (!unpaid.length) throw new Error("Уже оплачено");

  const reg = unpaid[0]!;
  const registrationId = reg.id;
  const unpaidIds = unpaid.map((r) => r.id);
  const amount = unpaid.reduce((sum, r) => sum + Number(r.amountRub), 0);
  const partyLabel =
    unpaid.length > 1
      ? unpaid
          .map((r) => {
            const title = r.slot?.title?.trim();
            return `${formatEventPartyRu(r)}${title ? ` (${title})` : ""}`;
          })
          .join(", ")
      : formatEventPartyRu(reg);

  async function stampPayment(data: {
    yookassaPaymentId?: string | null;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
  }) {
    await prisma.eventRegistration.updateMany({
      where: { id: { in: unpaidIds } },
      data,
    });
  }

  if (amount <= 0) {
    for (const id of unpaidIds) {
      await markEventRegistrationPaid({ registrationId: id });
    }
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    return `${origin}/client/registrations/${registrationId}?paid=1`;
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const returnUrl = `${origin}/client/registrations/${registrationId}?paid=1`;

  if (isMockCheckoutEnabled()) {
    const mockIntentId = `mock_event_${registrationId.slice(0, 12)}_${Date.now()}`;
    for (const id of unpaidIds) {
      await markEventRegistrationPaid({
        registrationId: id,
        stripePaymentIntentId: mockIntentId,
      });
    }
    return `${returnUrl}&mock=1`;
  }

  if (isYooKassaConfigured()) {
    const email = (customerEmail ?? reg.client.email)?.trim();
    if (!email) throw new Error("Укажите email для чека");

    // Не создавать новый платёж поверх существующего: иначе теряется id уже оплаченного.
    const sharedPaymentId = unpaid[0]?.yookassaPaymentId?.trim() ?? "";
    const existingPaymentId =
      sharedPaymentId && unpaid.every((r) => r.yookassaPaymentId?.trim() === sharedPaymentId)
        ? sharedPaymentId
        : "";
    if (existingPaymentId) {
      const existing = await fetchYooKassaPayment(existingPaymentId);
      if (existing?.status === "succeeded") {
        await stampPayment({ yookassaPaymentId: existingPaymentId });
        await markEventRegistrationPaid({
          registrationId,
          yookassaPaymentId: existingPaymentId,
        });
        return `${origin}/client/registrations/${registrationId}?paid=1`;
      }
      const reuseUrl = existing?.confirmation?.confirmation_url?.trim();
      if (
        existing &&
        (existing.status === "pending" || existing.status === "waiting_for_capture") &&
        reuseUrl
      ) {
        return reuseUrl;
      }
    }

    const recurring = isYooKassaRecurringEnabled();
    const savedId = (
      await prisma.user.findUnique({
        where: { id: reg.client.id },
        select: { yookassaPaymentMethodId: true },
      })
    )?.yookassaPaymentMethodId?.trim();

    const eventPayInput = {
      eventRegistrationId: registrationId,
      amountRub: amount,
      description: `${getPublicProductName()} — ${reg.event.title.slice(0, 80)} · ${partyLabel}`.slice(
        0,
        128,
      ),
      customerEmail: email,
      returnUrl,
      userId: reg.client.id,
    };

    let pay;
    try {
      pay = await createYooKassaEventPayment({
        ...eventPayInput,
        paymentMethodId: recurring ? savedId || undefined : undefined,
        savePaymentMethod: recurring && !savedId,
      });
    } catch (e) {
      if (recurring && savedId) {
        console.warn("[yookassa/event] saved method failed, checkout with save:", e);
        pay = await createYooKassaEventPayment({
          ...eventPayInput,
          savePaymentMethod: true,
        });
      } else {
        throw e;
      }
    }

    if (pay.status === "succeeded") {
      await saveCardFromPaymentMethodPayload(reg.client.id, {
        id: pay.paymentMethodId ?? savedId,
        saved: true,
      });
      await stampPayment({ yookassaPaymentId: pay.paymentId });
      await markEventRegistrationPaid({
        registrationId,
        yookassaPaymentId: pay.paymentId,
      });
      return `${returnUrl}&autopay=1`;
    }

    if (!pay.confirmationUrl) throw new Error("ЮKassa не вернула ссылку на оплату");

    await stampPayment({ yookassaPaymentId: pay.paymentId });

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

  await stampPayment({ stripeCheckoutSessionId: checkout.id });

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
