import { NextResponse } from "next/server";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { enrichClientEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import {
  buildRegistrationAmounts,
  createEventCheckoutUrl,
} from "@/lib/services/event-checkout";
import {
  clientCanAccessEvent,
  getEventCapacityState,
  isEventFree,
  registrationOpenForEvent,
} from "@/lib/services/event-registration";

type Ctx = { params: Promise<{ eventId: string }> };

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: Ctx) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const { eventId } = await ctx.params;

  const event = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
  });
  if (!event) {
    return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  }

  const canAccess = await clientCanAccessEvent(resolved.userId, event);
  if (!canAccess) {
    return NextResponse.json({ error: "Нет доступа к этому мероприятию" }, { status: 403 });
  }

  const capacity = await getEventCapacityState(event);
  if (!registrationOpenForEvent(event, capacity.isFull)) {
    return NextResponse.json(
      { error: "Запись на это мероприятие недоступна" },
      { status: 400 },
    );
  }

  const amounts = buildRegistrationAmounts(event.priceRub);
  const existing = await prisma.eventRegistration.findUnique({
    where: {
      eventId_clientId: { eventId, clientId: resolved.userId },
    },
  });

  if (existing?.status === "PAID") {
    return NextResponse.json({ error: "Вы уже записаны" }, { status: 400 });
  }

  let registrationId = existing?.id;

  if (!existing) {
    const created = await prisma.eventRegistration.create({
      data: {
        eventId,
        clientId: resolved.userId,
        status: amounts.requiresPayment ? "PENDING_PAYMENT" : "PAID",
        amountRub: amounts.amountRub,
        platformFeePercent: amounts.platformFeePercent,
        instructorShareAmount: amounts.instructorShareAmount,
        paidAt: amounts.requiresPayment ? null : new Date(),
      },
    });
    registrationId = created.id;
  } else if (existing.status === "CANCELLED") {
    const updated = await prisma.eventRegistration.update({
      where: { id: existing.id },
      data: {
        status: amounts.requiresPayment ? "PENDING_PAYMENT" : "PAID",
        amountRub: amounts.amountRub,
        platformFeePercent: amounts.platformFeePercent,
        instructorShareAmount: amounts.instructorShareAmount,
        paidAt: amounts.requiresPayment ? null : new Date(),
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
      },
    });
    registrationId = updated.id;
  } else if (existing.status === "PENDING_PAYMENT") {
    await prisma.eventRegistration.update({
      where: { id: existing.id },
      data: {
        amountRub: amounts.amountRub,
        platformFeePercent: amounts.platformFeePercent,
        instructorShareAmount: amounts.instructorShareAmount,
      },
    });
    registrationId = existing.id;
  }

  if (!registrationId) {
    return NextResponse.json({ error: "Не удалось создать запись" }, { status: 500 });
  }

  if (!amounts.requiresPayment || isEventFree(event.priceRub)) {
    const myRegistration = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
    });
    const enriched = await enrichClientEvent(
      event,
      myRegistration,
      null,
    );
    return NextResponse.json({
      event: enriched,
      registration: myRegistration,
      checkoutUrl: null,
      registrationPath: `/client/registrations/${registrationId}`,
      message: "Вы записаны на мероприятие",
    });
  }

  try {
    const checkoutUrl = await createEventCheckoutUrl(registrationId);
    const myRegistration = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
    });
    const enriched = await enrichClientEvent(event, myRegistration, null);

    return NextResponse.json({
      event: enriched,
      registration: myRegistration,
      checkoutUrl,
      registrationPath: `/client/registrations/${registrationId}`,
      message: "Перейдите к оплате для подтверждения записи",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось оформить оплату";
    return NextResponse.json(
      {
        error: message,
        registration: { id: registrationId },
        registrationPath: `/client/registrations/${registrationId}`,
      },
      { status: 502 },
    );
  }
}
