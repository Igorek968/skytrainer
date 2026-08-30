import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { resolveRouteParams } from "@/lib/api-route-params";
import {
  EVENT_SCHEDULE_REQUIRED_MESSAGE,
  instructorEventHasSchedule,
  isInstructorEventCompleted,
  serializeInstructorEvent,
} from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/services/admin-audit";
import {
  eventDayFromIso,
  parseEventDayYmd,
  slotsToFormInputs,
  syncEventSlots,
  type EventSlotInput,
} from "@/lib/services/event-slots";
import { upsertInstructorEventTitle } from "@/lib/services/instructor-event-titles";
import { ensureEventReadyForDeletion } from "@/lib/services/event-attendance";
import { adminUpdateInstructorEventSchema } from "@/lib/validations/instructor-event";

export const dynamic = "force-dynamic";

type Ctx = { params: { eventId: string } | Promise<{ eventId: string }> };

function parseEventAt(raw: string | null | undefined) {
  if (raw === null) return null;
  if (!raw) return undefined;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { eventId } = await resolveRouteParams(ctx.params);
  const row = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      catalogItem: { select: { id: true, title: true, status: true, citySlug: true, photoUrl: true } },
      slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
  }

  return NextResponse.json({
    event: {
      ...serializeInstructorEvent(row, { slots: row.slots }),
      slotInputs: slotsToFormInputs(row.slots),
      instructor: row.instructor,
      catalogItem: row.catalogItem,
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { eventId } = await resolveRouteParams(ctx.params);
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminUpdateInstructorEventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
    include: { slots: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
  }

  const data = parsed.data;
  const eventAt = parseEventAt(data.eventAt);
  if (data.eventAt !== undefined && data.eventAt && eventAt === null) {
    return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
  }

  const nextEventAt = eventAt !== undefined ? eventAt : existing.eventAt;
  const nextSlotsCount =
    data.slots !== undefined ? data.slots.length : existing.slots.length;
  if (
    !instructorEventHasSchedule({
      eventAt: nextEventAt,
      slotsCount: nextSlotsCount,
    })
  ) {
    return NextResponse.json({ error: EVENT_SCHEDULE_REQUIRED_MESSAGE }, { status: 400 });
  }

  let titleId = existing.titleId;
  let title = existing.title;
  if (data.title !== undefined) {
    const titleRow = await upsertInstructorEventTitle(existing.instructorId, data.title);
    titleId = titleRow.id;
    title = titleRow.title;
  }

  const venueAddress = data.venueAddress === undefined ? undefined : data.venueAddress || null;
  const venueLat = data.venueLat === undefined ? undefined : data.venueLat;
  const venueLng = data.venueLng === undefined ? undefined : data.venueLng;
  const nextAddress = venueAddress === undefined ? existing.venueAddress : venueAddress;
  const nextLat = venueLat === undefined ? existing.venueLat : venueLat;
  const nextLng = venueLng === undefined ? existing.venueLng : venueLng;
  if (nextAddress && (nextLat == null || nextLng == null)) {
    return NextResponse.json(
      { error: "Для адреса укажите координаты (venueLat / venueLng)" },
      { status: 400 },
    );
  }

  let moderationPatch: { moderationStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "PENDING_REVIEW" | "REJECTED" } =
    {};
  if (data.keepPublished === false && existing.moderationStatus === "PUBLISHED") {
    moderationPatch = { moderationStatus: "DRAFT" };
  }

  const row = await prisma.instructorEvent.update({
    where: { id: eventId },
    data: {
      ...(data.title !== undefined ? { titleId, title } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.orderId !== undefined ? { orderId: data.orderId?.trim() || null } : {}),
      ...(eventAt !== undefined ? { eventAt } : {}),
      ...(data.priceRub !== undefined ? { priceRub: data.priceRub } : {}),
      ...(data.maxRegistrations !== undefined ? { maxRegistrations: data.maxRegistrations } : {}),
      ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl || null } : {}),
      ...(venueAddress !== undefined ? { venueAddress } : {}),
      ...(venueLat !== undefined ? { venueLat } : {}),
      ...(venueLng !== undefined ? { venueLng } : {}),
      ...(data.repeatDaily !== undefined ? { repeatDaily: data.repeatDaily } : {}),
      ...moderationPatch,
    },
    include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
  });

  if (data.slots !== undefined) {
    const day =
      parseEventDayYmd(data.eventDay ?? null) ??
      (row.eventAt ? parseEventDayYmd(eventDayFromIso(row.eventAt.toISOString())) : null) ??
      (row.slots[0] ? parseEventDayYmd(eventDayFromIso(row.slots[0].startsAt.toISOString())) : null);
    try {
      await syncEventSlots(eventId, day, data.slots as EventSlotInput[]);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Ошибка слотов" },
        { status: 400 },
      );
    }
  }

  const fresh = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      catalogItem: { select: { id: true, title: true, status: true, citySlug: true, photoUrl: true } },
      slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
    },
  });

  await writeAdminAudit({
    actorId: auth.userId,
    action: "event.update",
    entity: "InstructorEvent",
    entityId: eventId,
    summary: `Обновлено событие «${fresh?.title ?? eventId}»`,
  });

  return NextResponse.json({
    event: {
      ...serializeInstructorEvent(fresh!, { slots: fresh!.slots }),
      slotInputs: slotsToFormInputs(fresh!.slots),
      instructor: fresh!.instructor,
      catalogItem: fresh!.catalogItem,
    },
    message: "Событие обновлено",
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { eventId } = await resolveRouteParams(ctx.params);
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "1";

  const existing = await prisma.instructorEvent.findUnique({ where: { id: eventId } });
  if (!existing) {
    return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
  }

  if (!hard && existing.moderationStatus === "PUBLISHED") {
    const row = await prisma.instructorEvent.update({
      where: { id: eventId },
      data: { moderationStatus: "ARCHIVED" },
    });
    await writeAdminAudit({
      actorId: auth.userId,
      action: "event.unpublish",
      entity: "InstructorEvent",
      entityId: eventId,
      summary: `Снято с публикации: ${existing.title}`,
    });
    return NextResponse.json({
      ok: true,
      archived: true,
      event: serializeInstructorEvent(row),
      message: "Событие снято с публикации",
    });
  }

  if (isInstructorEventCompleted(existing.eventAt)) {
    const readiness = await ensureEventReadyForDeletion(eventId);
    if (!readiness.ok) {
      return NextResponse.json(
        {
          error: `Не все участники подтвердили участие (${readiness.unconfirmed}).`,
        },
        { status: 409 },
      );
    }
  } else {
    const paidCount = await prisma.eventRegistration.count({
      where: { eventId, status: "PAID" },
    });
    if (paidCount > 0) {
      return NextResponse.json(
        { error: "Нельзя удалить: есть оплаченные записи" },
        { status: 400 },
      );
    }
  }

  await prisma.instructorEvent.delete({ where: { id: eventId } });
  await writeAdminAudit({
    actorId: auth.userId,
    action: "event.delete",
    entity: "InstructorEvent",
    entityId: eventId,
    summary: `Удалено событие «${existing.title}»`,
  });

  return NextResponse.json({ ok: true, message: "Событие удалено" });
}
