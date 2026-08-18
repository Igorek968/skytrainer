import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { serializeInstructorEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ eventId: string }> };

/** Снять опубликованное событие с ленты клиентов (как «Скрыть» у инструктора). */
export async function POST(_req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { eventId } = await ctx.params;
  const existing = await prisma.instructorEvent.findUnique({ where: { id: eventId } });
  if (!existing) {
    return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
  }
  if (existing.moderationStatus !== "PUBLISHED") {
    return NextResponse.json(
      { error: "Снять с публикации можно только опубликованное событие" },
      { status: 400 },
    );
  }

  const row = await prisma.instructorEvent.update({
    where: { id: eventId },
    data: { moderationStatus: "ARCHIVED" },
  });

  return NextResponse.json({
    event: serializeInstructorEvent(row),
    message: "Событие снято с публикации (скрыто из ленты)",
  });
}
