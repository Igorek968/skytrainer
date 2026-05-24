import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { serializeInstructorEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { adminEventReviewSchema } from "@/lib/validations/instructor-event";

type Ctx = { params: Promise<{ eventId: string }> };

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { eventId } = await ctx.params;

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
    return NextResponse.json({ event: serializeInstructorEvent(row) });
  }

  const row = await prisma.instructorEvent.update({
    where: { id: eventId },
    data: {
      moderationStatus: "PUBLISHED",
      publishedAt: new Date(),
      rejectNote: null,
    },
  });

  return NextResponse.json({ event: serializeInstructorEvent(row) });
}
