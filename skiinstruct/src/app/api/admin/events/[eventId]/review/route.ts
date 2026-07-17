import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { resolveRouteParams } from "@/lib/api-route-params";
import { serializeInstructorEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { ensureUpcomingDailyCopy } from "@/lib/services/instructor-event-daily-repeat";
import { adminEventReviewSchema } from "@/lib/validations/instructor-event";

type Ctx = { params: { eventId: string } | Promise<{ eventId: string }> };

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { eventId } = await resolveRouteParams(ctx.params);
  if (!eventId?.trim()) {
    return NextResponse.json({ error: "Не указан id мероприятия" }, { status: 400 });
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

  const existing = await prisma.instructorEvent.findUnique({ where: { id: eventId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.moderationStatus !== "PENDING_REVIEW") {
    return NextResponse.json({ error: "Мероприятие не на модерации" }, { status: 400 });
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
      message: "Мероприятие отклонено, инструктор увидит комментарий.",
    });
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

  if (row.repeatDaily) {
    await ensureUpcomingDailyCopy(row);
  }

  return NextResponse.json({
    event: serializeInstructorEvent(row),
    message: "Мероприятие опубликовано — появится в ленте и на карте клиентов (если указано место).",
  });
}
