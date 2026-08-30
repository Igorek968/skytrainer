import { NextResponse } from "next/server";
import { z } from "zod";

import { eventPartyError, eventRegistrationSeatCount, normalizeEventParty } from "@/lib/event-party";
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
  items: z
    .array(
      z.object({
        slotId: z.string().cuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
  adultCount: z.number().int().min(0).max(20).optional(),
  childCount: z.number().int().min(0).max(20).optional(),
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
  checkoutRegistrationIds?: string[];
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
    const checkoutUrl = await createEventCheckoutUrl(
      opts.checkoutRegistrationIds?.length ? opts.checkoutRegistrationIds : opts.registrationId,
      opts.clientEmail,
    );
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
  const party = normalizeEventParty({
    adultCount: parsed.data.adultCount,
    childCount: parsed.data.childCount,
  });
  if (!parsed.data.items?.length) {
    const partyErr = eventPartyError(party);
    if (partyErr) {
      return NextResponse.json({ error: partyErr }, { status: 400 });
    }
  }
  const seats = eventRegistrationSeatCount(party);

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

  const slotItems =
    parsed.data.items?.map((it) => ({ slotId: it.slotId, quantity: it.quantity })) ??
    (slotId ? [{ slotId, quantity: seats }] : []);

  if (hasSlots) {
    if (!slotItems.length) {
      return NextResponse.json({ error: "Выберите тариф и число мест" }, { status: 400 });
    }
    const seen = new Set<string>();
    const created: { id: string; requiresPayment: boolean }[] = [];

    for (const item of slotItems) {
      if (seen.has(item.slotId)) {
        return NextResponse.json({ error: "Тариф выбран дважды" }, { status: 400 });
      }
      seen.add(item.slotId);
      const slot = event.slots.find((s) => s.id === item.slotId);
      if (!slot) {
        return NextResponse.json({ error: "Выход не найден" }, { status: 404 });
      }
      const qty = item.quantity;
      const partyFields = { adultCount: qty, childCount: 0 };

      const regKey = slotRegistrationKey(slot.id, resolved.userId);
      const existing =
        (await prisma.eventRegistration.findUnique({ where: { registrationKey: regKey } })) ??
        (await prisma.eventRegistration.findFirst({
          where: { slotId: slot.id, clientId: resolved.userId },
        }));

      if (existing?.status === "PAID") {
        return NextResponse.json(
          { error: `Вы уже записаны: ${slot.title?.trim() || "этот тариф"}` },
          { status: 400 },
        );
      }

      const capacity = await getSlotCapacityState(slot);
      const existingSeats =
        existing && existing.status === "PENDING_PAYMENT"
          ? eventRegistrationSeatCount(existing)
          : 0;
      const available =
        slot.maxSeats != null ? Math.max(0, slot.maxSeats - capacity.paidCount + existingSeats) : null;
      if (available != null && qty > available) {
        return NextResponse.json(
          {
            error:
              available < 1
                ? `Мест нет: ${slot.title?.trim() || "тариф"}`
                : `«${slot.title?.trim() || "тариф"}»: свободно ${available}`,
          },
          { status: 400 },
        );
      }
      if (!slotRegistrationOpen(slot, event, false)) {
        return NextResponse.json({ error: "Запись на это время недоступна" }, { status: 400 });
      }

      const unitPrice = slot.priceRub ?? 0;
      const amounts = buildRegistrationAmounts(unitPrice > 0 ? unitPrice * qty : unitPrice);

      let registrationId = existing?.id;

      if (!existing) {
        const createdRow = await prisma.eventRegistration.create({
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
            ...partyFields,
          },
        });
        registrationId = createdRow.id;
        if (!amounts.requiresPayment) {
          void notifyInstructorOfEventRegistration(createdRow.id);
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
            ...partyFields,
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
            ...partyFields,
          },
        });
        registrationId = existing.id;
      }

      if (!registrationId) {
        return NextResponse.json({ error: "Не удалось создать запись" }, { status: 500 });
      }
      created.push({ id: registrationId, requiresPayment: amounts.requiresPayment });
    }

    const payableIds = created.filter((c) => c.requiresPayment).map((c) => c.id);
    return respondWithRegistration({
      eventId,
      registrationId: created[0]!.id,
      clientId: resolved.userId,
      clientEmail,
      requiresPayment: payableIds.length > 0,
      checkoutRegistrationIds: payableIds.length ? payableIds : undefined,
      event,
    });
  }

  const regKey = legacyEventRegistrationKey(eventId, resolved.userId);
  const existing =
    (await prisma.eventRegistration.findUnique({ where: { registrationKey: regKey } })) ??
    (await prisma.eventRegistration.findFirst({
      where: { eventId, clientId: resolved.userId, slotId: null },
    }));

  if (existing?.status === "PAID") {
    return NextResponse.json({ error: "Вы уже записаны" }, { status: 400 });
  }

  const capacity = await getEventCapacityState(event);
  const existingSeats =
    existing && existing.status === "PENDING_PAYMENT" ? eventRegistrationSeatCount(existing) : 0;
  const available =
    event.maxRegistrations != null
      ? Math.max(0, event.maxRegistrations - capacity.paidCount + existingSeats)
      : null;
  if (available != null && seats > available) {
    return NextResponse.json(
      { error: available < 1 ? "Мест нет" : `Свободно мест: ${available}` },
      { status: 400 },
    );
  }
  if (!registrationOpenForEvent(event, false)) {
    return NextResponse.json({ error: "Запись на это событие недоступна" }, { status: 400 });
  }

  const unitPrice = event.priceRub ?? 0;
  const amounts = buildRegistrationAmounts(unitPrice > 0 ? unitPrice * seats : unitPrice);
  const partyFields = {
    adultCount: party.adultCount,
    childCount: party.childCount,
  };

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
        ...partyFields,
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
        ...partyFields,
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
        ...partyFields,
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
