import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  canEditInstructorEvent,
  formatSlotTimeRu,
  serializeInstructorEvent,
} from "@/lib/instructor-events";
import { duplicatePublicUploadForEvent } from "@/lib/public-uploads";
import { canonicalizeActivityLabel } from "@/lib/services/instructor-match";
import { prisma } from "@/lib/prisma";
import {
  listInstructorEventTitles,
  upsertInstructorEventTitle,
} from "@/lib/services/instructor-event-titles";
import { archivePastPublishedInstructorEvents } from "@/lib/services/instructor-event-expiry";
import { syncEventSlots, eventDayFromIso, type EventSlotInput } from "@/lib/services/event-slots";
import { createInstructorEventSchema } from "@/lib/validations/instructor-event";

export const dynamic = "force-dynamic";

function parseEventAt(raw: string | null | undefined) {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function parseEventDay(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

async function serializeEventWithSlots(
  row: Awaited<ReturnType<typeof prisma.instructorEvent.findMany>>[number] & {
    slots?: {
      id: string;
      startsAt: Date;
      title: string | null;
      maxSeats: number | null;
      priceRub: number | null;
      sortOrder: number;
    }[];
  },
  extra?: Parameters<typeof serializeInstructorEvent>[1],
) {
  const slots = row.slots ?? [];
  const base = serializeInstructorEvent(row, { ...extra, slots });
  if (!slots.length) {
    return {
      ...base,
      slots: [] as {
        id: string;
        date: string;
        time: string;
        title: string | null;
        maxSeats: number | null;
        priceRub: number | null;
        paidCount: number;
        startsAt: string;
      }[],
    };
  }

  const counts = await prisma.eventRegistration.groupBy({
    by: ["slotId"],
    where: {
      slotId: { in: slots.map((s) => s.id) },
      status: { in: ["PAID", "PENDING_PAYMENT"] },
    },
    _count: { _all: true },
  });
  const countBySlot = new Map(counts.map((c) => [c.slotId!, c._count._all]));

  return {
    ...base,
    hasSlots: true,
    slots: slots.map((s) => ({
      id: s.id,
      date: eventDayFromIso(s.startsAt.toISOString()),
      time: formatSlotTimeRu(s.startsAt),
      title: s.title ?? null,
      maxSeats: s.maxSeats,
      priceRub: s.priceRub,
      startsAt: s.startsAt.toISOString(),
      paidCount: countBySlot.get(s.id) ?? 0,
    })),
  };
}

export async function GET() {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  await archivePastPublishedInstructorEvents({ instructorId: userId });

  const [rows, titles, activeGroups, settledGroups, unconfirmedGroups] = await Promise.all([
    prisma.instructorEvent.findMany({
      where: { instructorId: userId },
      orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }],
      take: 80,
      include: {
        slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
      },
    }),
    listInstructorEventTitles(userId),
    prisma.eventRegistration.groupBy({
      by: ["eventId"],
      where: {
        status: { in: ["PAID", "PENDING_PAYMENT"] },
        event: { instructorId: userId },
      },
      _count: { _all: true },
    }),
    prisma.eventRegistration.groupBy({
      by: ["eventId"],
      where: {
        status: "PAID",
        attendanceConfirmedAt: { not: null },
        event: { instructorId: userId },
      },
      _count: { _all: true },
      _sum: { instructorShareAmount: true },
    }),
    prisma.eventRegistration.groupBy({
      by: ["eventId"],
      where: {
        status: { in: ["PAID", "PENDING_PAYMENT"] },
        attendanceConfirmedAt: null,
        event: { instructorId: userId, eventAt: { lte: new Date() } },
      },
      _count: { _all: true },
    }),
  ]);

  const activeByEvent = new Map(activeGroups.map((g) => [g.eventId, g._count._all]));
  const settledByEvent = new Map(
    settledGroups.map((g) => [
      g.eventId,
      {
        settledCount: g._count._all,
        registrationRevenueRub: Number(g._sum.instructorShareAmount ?? 0),
      },
    ]),
  );
  const unconfirmedByEvent = new Map(unconfirmedGroups.map((g) => [g.eventId, g._count._all]));

  return NextResponse.json({
    events: await Promise.all(
      rows.map(async (row) => {
        const settled = settledByEvent.get(row.id);
        return serializeEventWithSlots(row, {
          paidRegistrationCount: activeByEvent.get(row.id) ?? 0,
          registrationRevenueRub: settled?.registrationRevenueRub ?? 0,
          unconfirmedAttendanceCount: unconfirmedByEvent.get(row.id) ?? 0,
        });
      }),
    ),
    titles,
  });
}

export async function POST(req: Request) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректные данные запроса" }, { status: 400 });
  }

  const parsed = createInstructorEventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orderId = parsed.data.orderId?.trim() || null;
  if (orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, instructorId: userId },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json(
        { error: "Заказ не найден или не назначен на вас" },
        { status: 400 },
      );
    }
  }

  const hasSlots = Array.isArray(parsed.data.slots) && parsed.data.slots.length > 0;

  let eventAt = parseEventAt(parsed.data.eventAt ?? null);
  const eventDay = parseEventDay(parsed.data.eventDay ?? null);

  const venueAddress = parsed.data.venueAddress?.trim() || null;
  const venueLat =
    parsed.data.venueLat != null && Number.isFinite(parsed.data.venueLat)
      ? parsed.data.venueLat
      : null;
  const venueLng =
    parsed.data.venueLng != null && Number.isFinite(parsed.data.venueLng)
      ? parsed.data.venueLng
      : null;
  if (venueAddress && (venueLat == null || venueLng == null)) {
    return NextResponse.json(
      { error: "Укажите адрес на карте — нажмите «Найти» или выберите точку кликом" },
      { status: 400 },
    );
  }
  const venueData = {
    venueAddress,
    venueLat: venueAddress ? venueLat : null,
    venueLng: venueAddress ? venueLng : null,
  };
  const repeatDaily = parsed.data.repeatDaily ?? false;

  if (hasSlots) {
    const slotInputs = (parsed.data.slots ?? []) as EventSlotInput[];
    const allHaveDate = slotInputs.every((s) => Boolean(s.date?.trim()));
    if (!eventDay && !allHaveDate) {
      return NextResponse.json(
        { error: "Укажите дату для каждого выхода или общий день мероприятия" },
        { status: 400 },
      );
    }
    eventAt = null;
  } else if (parsed.data.eventAt && !eventAt) {
    return NextResponse.json({ error: "Некорректная дата мероприятия" }, { status: 400 });
  }

  const titleRow = await upsertInstructorEventTitle(userId, parsed.data.title);
  const slotInputs = (parsed.data.slots ?? []) as EventSlotInput[];
  const category = canonicalizeActivityLabel(parsed.data.category) ?? parsed.data.category;

  const saveSlotsForEvent = async (eventId: string) => {
    if (!hasSlots) return;
    await syncEventSlots(eventId, eventDay, slotInputs);
  };

  const existingId = parsed.data.eventId?.trim();
  if (existingId) {
    const existing = await prisma.instructorEvent.findFirst({
      where: { id: existingId, instructorId: userId },
      include: { slots: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
    }
    if (existing.moderationStatus === "ARCHIVED") {
      return NextResponse.json(
        { error: "Скрытое мероприятие нельзя изменить. Создайте новое." },
        { status: 400 },
      );
    }
    if (!canEditInstructorEvent(existing)) {
      return NextResponse.json(
        { error: "Выполненное или опубликованное мероприятие нельзя изменить" },
        { status: 400 },
      );
    }
    const row = await prisma.instructorEvent.update({
      where: { id: existingId },
      data: {
        titleId: titleRow.id,
        title: titleRow.title,
        body: parsed.data.body,
        category,
        eventAt: hasSlots ? existing.eventAt : eventAt,
        orderId,
        priceRub: hasSlots ? null : (parsed.data.priceRub ?? null),
        maxRegistrations: hasSlots ? null : (parsed.data.maxRegistrations ?? null),
        moderationStatus: "DRAFT",
        rejectNote: null,
        repeatDaily,
        ...venueData,
      },
      include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
    });
    if (hasSlots) {
      await saveSlotsForEvent(existingId);
    }
    const refreshed = await prisma.instructorEvent.findUnique({
      where: { id: existingId },
      include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
    });
    return NextResponse.json({
      event: await serializeEventWithSlots(refreshed ?? row),
    });
  }

  const row = await prisma.instructorEvent.create({
    data: {
      instructorId: userId,
      titleId: titleRow.id,
      title: titleRow.title,
      body: parsed.data.body,
      category,
      eventAt: hasSlots ? null : eventAt,
      orderId,
      priceRub: hasSlots ? null : (parsed.data.priceRub ?? null),
      maxRegistrations: hasSlots ? null : (parsed.data.maxRegistrations ?? null),
      moderationStatus: "DRAFT",
      repeatDaily,
      ...venueData,
    },
    include: { slots: true },
  });

  if (hasSlots) {
    await saveSlotsForEvent(row.id);
  }

  const refreshed = await prisma.instructorEvent.findUnique({
    where: { id: row.id },
    include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
  });

  let resultRow = refreshed ?? row;

  const copyPhotoFrom = parsed.data.copyPhotoFromEventId?.trim();
  if (copyPhotoFrom && !existingId) {
    const source = await prisma.instructorEvent.findFirst({
      where: { id: copyPhotoFrom, instructorId: userId },
      select: { photoUrl: true },
    });
    if (source?.photoUrl) {
      const photoUrl = await duplicatePublicUploadForEvent(source.photoUrl, resultRow.id);
      if (photoUrl) {
        resultRow = await prisma.instructorEvent.update({
          where: { id: resultRow.id },
          data: { photoUrl },
          include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
        });
      }
    }
  }

  return NextResponse.json({
    event: await serializeEventWithSlots(resultRow),
  });
}
