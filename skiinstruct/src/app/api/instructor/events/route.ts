import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { canEditInstructorEvent, serializeInstructorEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import {
  findLatestEventByTitle,
  listInstructorEventTitles,
  upsertInstructorEventTitle,
} from "@/lib/services/instructor-event-titles";
import { archivePastPublishedInstructorEvents } from "@/lib/services/instructor-event-expiry";
import { createInstructorEventSchema } from "@/lib/validations/instructor-event";

export const dynamic = "force-dynamic";

function parseEventAt(raw: string | null | undefined) {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
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
    events: rows.map((row) => {
      const settled = settledByEvent.get(row.id);
      return serializeInstructorEvent(row, {
        paidRegistrationCount: activeByEvent.get(row.id) ?? 0,
        registrationRevenueRub: settled?.registrationRevenueRub ?? 0,
        unconfirmedAttendanceCount: unconfirmedByEvent.get(row.id) ?? 0,
      });
    }),
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  const eventAt = parseEventAt(parsed.data.eventAt ?? null);
  if (parsed.data.eventAt && !eventAt) {
    return NextResponse.json({ error: "Некорректная дата мероприятия" }, { status: 400 });
  }

  const titleRow = await upsertInstructorEventTitle(userId, parsed.data.title);

  const existingId = parsed.data.eventId?.trim();
  if (existingId) {
    const existing = await prisma.instructorEvent.findFirst({
      where: { id: existingId, instructorId: userId },
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
        eventAt,
        orderId,
        priceRub: parsed.data.priceRub ?? null,
        maxRegistrations: parsed.data.maxRegistrations ?? null,
        moderationStatus: "DRAFT",
        rejectNote: null,
      },
    });
    return NextResponse.json({ event: serializeInstructorEvent(row) });
  }

  const row = await prisma.instructorEvent.create({
    data: {
      instructorId: userId,
      titleId: titleRow.id,
      title: titleRow.title,
      body: parsed.data.body,
      eventAt,
      orderId,
      priceRub: parsed.data.priceRub ?? null,
      maxRegistrations: parsed.data.maxRegistrations ?? null,
      moderationStatus: "DRAFT",
    },
  });

  return NextResponse.json({ event: serializeInstructorEvent(row) });
}
