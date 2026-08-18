import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { resolveRouteParams } from "@/lib/api-route-params";
import { notifyBotEventPublished } from "@/lib/bot-api";
import {
  EVENT_SCHEDULE_REQUIRED_MESSAGE,
  instructorEventHasSchedule,
  serializeInstructorEvent,
} from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { adminEventReviewSchema } from "@/lib/validations/instructor-event";

type Ctx = { params: { eventId: string } | Promise<{ eventId: string }> };

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { eventId } = await resolveRouteParams(ctx.params);
  if (!eventId?.trim()) {
    return NextResponse.json({ error: "Не указан id события" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminEventReviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
    include: { slots: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.moderationStatus !== "PENDING_REVIEW") {
    return NextResponse.json({ error: "Событие не на модерации" }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    const note = parsed.data.rejectNote?.trim() || "Отклонено администратором";
    const row = await prisma.instructorEvent.update({
      where: { id: eventId },
      data: {
        moderationStatus: "REJECTED",
        rejectNote: note,
      },
    });
    return NextResponse.json({
      event: serializeInstructorEvent(row),
      message: "Событие отклонено, инструктор увидит комментарий.",
    });
  }

  if (
    !instructorEventHasSchedule({
      eventAt: existing.eventAt,
      slotsCount: existing.slots.length,
    })
  ) {
    return NextResponse.json(
      {
        error: `${EVENT_SCHEDULE_REQUIRED_MESSAGE}. Отредактируйте событие или отклоните заявку.`,
      },
      { status: 400 },
    );
  }

  const row = await prisma.instructorEvent.update({
    where: { id: eventId },
    data: {
      moderationStatus: "PUBLISHED",
      publishedAt: new Date(),
      rejectNote: null,
    },
    include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
  });

  notifyBotEventPublished(row.id);

  return NextResponse.json({
    event: serializeInstructorEvent(row),
    message: row.catalogItemId
      ? "Участие одобрено — инструктор появится в карточке каталога у клиентов."
      : "Событие опубликовано — появится в ленте и на карте клиентов (если указано место).",
  });
}
