import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { isInstructorEventCompleted, serializeInstructorEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  repeatDaily: z.boolean(),
});

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.instructorEvent.findFirst({
    where: { id, instructorId: userId },
    include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
  }

  if (existing.moderationStatus !== "PUBLISHED") {
    return NextResponse.json(
      { error: "Автовыкладывание доступно только для опубликованных событий" },
      { status: 400 },
    );
  }

  if (isInstructorEventCompleted(existing.eventAt) && !existing.slots.length) {
    return NextResponse.json(
      { error: "Событие уже завершено — включите на актуальном опубликованном" },
      { status: 400 },
    );
  }

  const row = await prisma.instructorEvent.update({
    where: { id },
    data: { repeatDaily: parsed.data.repeatDaily },
    include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
  });

  return NextResponse.json({ event: serializeInstructorEvent(row) });
}
