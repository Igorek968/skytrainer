import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { enrichClientEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { buildRegistrationAmounts } from "@/lib/services/event-checkout";
import { notifyInstructorOfEventRegistration } from "@/lib/services/event-registration-notify";
import {
  clientCanAccessEvent,
  getEventCapacityState,
  isEventFree,
  registrationOpenForEvent,
} from "@/lib/services/event-registration";
import {
  getSlotCapacityState,
  legacyEventRegistrationKey,
  slotRegistrationKey,
  slotRegistrationOpen,
} from "@/lib/services/event-slots";

type Ctx = { params: Promise<{ eventId: string }> };

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slotId: z.string().cuid().optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const { eventId } = await ctx.params;

  let slotId: string | undefined;
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) slotId = parsed.data.slotId;
  } catch {
    /* empty body ok for legacy */
  }

  const event = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
    include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
  });
  if (!event) {
    return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  }

  const canAccess = await clientCanAccessEvent(resolved.userId, event);
  if (!canAccess) {
    return NextResponse.json({ error: "Нет доступа к этому мероприятию" }, { status: 403 });
  }

  const hasSlots = event.slots.length > 0;

  if (hasSlots) {
    if (!slotId) {
      return NextResponse.json({ error: "Выберите время выхода" }, { status: 400 });
    }
    const slot = event.slots.find((s) => s.id === slotId);
    if (!slot) {
      return NextResponse.json({ error: "Выход не найден" }, { status: 404 });
    }

    const capacity = await getSlotCapacityState(slot);
    if (!slotRegistrationOpen(slot, event, capacity.isFull)) {
      return NextResponse.json({ error: "Запись на это время недоступна" }, { status: 400 });
    }

    const amounts = buildRegistrationAmounts(slot.priceRub);
    const regKey = slotRegistrationKey(slot.id, resolved.userId);

    const existing =
      (await prisma.eventRegistration.findUnique({ where: { registrationKey: regKey } })) ??
      (await prisma.eventRegistration.findFirst({
        where: { slotId: slot.id, clientId: resolved.userId },
      }));

    if (existing?.status === "PAID" || existing?.status === "PENDING_PAYMENT") {
      return NextResponse.json({ error: "Вы уже записаны на это время" }, { status: 400 });
    }

    let registrationId = existing?.id;

    if (!existing) {
      const created = await prisma.eventRegistration.create({
        data: {
          eventId,
          slotId: slot.id,
          clientId: resolved.userId,
          registrationKey: regKey,
          status: amounts.requiresPayment ? "PENDING_PAYMENT" : "PAID",
          amountRub: amounts.amountRub,
          platformFeePercent: amounts.platformFeePercent,
          instructorShareAmount: amounts.instructorShareAmount,
          paidAt: amounts.requiresPayment ? null : new Date(),
        },
      });
      registrationId = created.id;
      void notifyInstructorOfEventRegistration(created.id);
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
      void notifyInstructorOfEventRegistration(updated.id);
    }

    const myRegistration = registrationId
      ? await prisma.eventRegistration.findUnique({ where: { id: registrationId } })
      : null;
    const enriched = await enrichClientEvent(event, myRegistration, null, resolved.userId);

    return NextResponse.json({
      event: enriched,
      registration: myRegistration,
      checkoutUrl: null,
      registrationPath: registrationId ? `/client/registrations/${registrationId}` : null,
      message: amounts.requiresPayment
        ? "Вы записаны. Оплата будет доступна после мероприятия."
        : "Вы записаны на выбранное время",
    });
  }

  const capacity = await getEventCapacityState(event);
  if (!registrationOpenForEvent(event, capacity.isFull)) {
    return NextResponse.json({ error: "Запись на это мероприятие недоступна" }, { status: 400 });
  }

  const amounts = buildRegistrationAmounts(event.priceRub);
  const regKey = legacyEventRegistrationKey(eventId, resolved.userId);

  const existing =
    (await prisma.eventRegistration.findUnique({ where: { registrationKey: regKey } })) ??
    (await prisma.eventRegistration.findFirst({
      where: { eventId, clientId: resolved.userId, slotId: null },
    }));

  if (existing?.status === "PAID") {
    return NextResponse.json({ error: "Вы уже записаны" }, { status: 400 });
  }

  if (existing?.status === "PENDING_PAYMENT" && existing.paidAt) {
    return NextResponse.json({ error: "Вы уже записаны" }, { status: 400 });
  }

  let registrationId = existing?.id;

  if (!existing) {
    const created = await prisma.eventRegistration.create({
      data: {
        eventId,
        clientId: resolved.userId,
        registrationKey: regKey,
        status: amounts.requiresPayment ? "PENDING_PAYMENT" : "PAID",
        amountRub: amounts.amountRub,
        platformFeePercent: amounts.platformFeePercent,
        instructorShareAmount: amounts.instructorShareAmount,
        paidAt: amounts.requiresPayment ? null : new Date(),
      },
    });
    registrationId = created.id;
    void notifyInstructorOfEventRegistration(created.id);
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
    void notifyInstructorOfEventRegistration(updated.id);
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
    const enriched = await enrichClientEvent(event, myRegistration, null, resolved.userId);
    return NextResponse.json({
      event: enriched,
      registration: myRegistration,
      checkoutUrl: null,
      registrationPath: `/client/registrations/${registrationId}`,
      message: "Вы записаны на мероприятие",
    });
  }

  const myRegistration = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
  });
  const enriched = await enrichClientEvent(event, myRegistration, null, resolved.userId);

  return NextResponse.json({
    event: enriched,
    registration: myRegistration,
    checkoutUrl: null,
    registrationPath: `/client/registrations/${registrationId}`,
    message:
      "Вы записаны. Оплата будет доступна после мероприятия — подтвердите участие, и средства поступят инструктору.",
  });
}
