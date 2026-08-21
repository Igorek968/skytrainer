import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { enrichClientEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import {
  buildRegistrationAmounts,
  createEventCheckoutUrl,
} from "@/lib/services/event-checkout";
import { notifyInstructorOfEventRegistration } from "@/lib/services/event-registration-notify";
import {
  clientCanAccessEvent,
  getEventCapacityState,
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
  acceptLegal: z.literal(true, {
    errorMap: () => ({ message: "Необходимо согласие с офертой и политикой ПДн" }),
  }),
});

async function respondWithRegistration(opts: {
  eventId: string;
  registrationId: string;
  clientId: string;
  clientEmail: string | null | undefined;
  requiresPayment: boolean;
  event: Parameters<typeof enrichClientEvent>[0];
}) {
  const myRegistration = await prisma.eventRegistration.findUnique({
    where: { id: opts.registrationId },
  });
  const enriched = await enrichClientEvent(opts.event, myRegistration, null, opts.clientId);
  const registrationPath = `/client/registrations/${opts.registrationId}`;

  if (!opts.requiresPayment) {
    return NextResponse.json({
      event: enriched,
      registration: myRegistration,
      checkoutUrl: null,
      registrationPath,
      message: "Вы записаны на событие",
    });
  }

  try {
    const checkoutUrl = await createEventCheckoutUrl(opts.registrationId, opts.clientEmail);
    return NextResponse.json({
      event: enriched,
      registration: myRegistration,
      checkoutUrl,
      registrationPath,
      message: "Перейдите к оплате — место бронируется после успешной оплаты",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось открыть оплату";
    return NextResponse.json(
      {
        error: message,
        registration: myRegistration,
        registrationPath,
        checkoutUrl: null,
      },
      { status: 502 },
    );
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const { eventId } = await ctx.params;

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Некорректный запрос";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const slotId = parsed.data.slotId;

  const event = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
    include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
  });
  if (!event) {
    return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
  }

  const canAccess = await clientCanAccessEvent(resolved.userId, event);
  if (!canAccess) {
    return NextResponse.json({ error: "Нет доступа к этому событию" }, { status: 403 });
  }

  const clientEmail = resolved.session.user.email;
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

    if (existing?.status === "PAID") {
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
      if (!amounts.requiresPayment) {
        void notifyInstructorOfEventRegistration(created.id);
      }
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
          yookassaPaymentId: null,
        },
      });
      registrationId = updated.id;
      if (!amounts.requiresPayment) {
        void notifyInstructorOfEventRegistration(updated.id);
      }
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

    return respondWithRegistration({
      eventId,
      registrationId,
      clientId: resolved.userId,
      clientEmail,
      requiresPayment: amounts.requiresPayment,
      event,
    });
  }

  const capacity = await getEventCapacityState(event);
  if (!registrationOpenForEvent(event, capacity.isFull)) {
    return NextResponse.json({ error: "Запись на это событие недоступна" }, { status: 400 });
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
    if (!amounts.requiresPayment) {
      void notifyInstructorOfEventRegistration(created.id);
    }
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
        yookassaPaymentId: null,
      },
    });
    registrationId = updated.id;
    if (!amounts.requiresPayment) {
      void notifyInstructorOfEventRegistration(updated.id);
    }
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

  return respondWithRegistration({
    eventId,
    registrationId,
    clientId: resolved.userId,
    clientEmail,
    requiresPayment: amounts.requiresPayment,
    event,
  });
}
