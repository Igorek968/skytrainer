import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { isInstructorEventCompleted, serializeInstructorEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** Вернуть скрытое мероприятие в черновик для правок и повторной модерации. */
export async function POST(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id } = await ctx.params;

  const existing = await prisma.instructorEvent.findFirst({
    where: { id, instructorId: userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.moderationStatus !== "ARCHIVED") {
    return NextResponse.json({ error: "Восстановить можно только скрытое мероприятие" }, { status: 400 });
  }

  if (isInstructorEventCompleted(existing.eventAt)) {
    return NextResponse.json(
      { error: "Выполненное мероприятие нельзя восстановить. Создайте новое." },
      { status: 400 },
    );
  }

  const paidCount = await prisma.eventRegistration.count({
    where: { eventId: id, status: "PAID" },
  });
  if (paidCount > 0) {
    return NextResponse.json(
      {
        error:
          "У мероприятия есть оплаченные записи — восстановление недоступно. Создайте новое объявление.",
      },
      { status: 400 },
    );
  }

  const row = await prisma.instructorEvent.update({
    where: { id },
    data: {
      moderationStatus: "DRAFT",
      rejectNote: null,
      submittedAt: null,
      publishedAt: null,
    },
  });

  return NextResponse.json({
    event: serializeInstructorEvent(row),
    message: "Мероприятие снова в черновиках — можно редактировать и отправить на модерацию.",
  });
}
