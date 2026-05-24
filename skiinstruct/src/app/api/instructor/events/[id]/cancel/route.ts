import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { isInstructorEventCompleted } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { cancelEventRegistrationByInstructor } from "@/lib/services/event-registration-cancel";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** Скрыть мероприятие и отменить все активные записи (с возвратом). */
export async function POST(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id: eventId } = await ctx.params;

  const event = await prisma.instructorEvent.findFirst({
    where: { id: eventId, instructorId: userId },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isInstructorEventCompleted(event.eventAt)) {
    return NextResponse.json({ error: "Мероприятие уже прошло" }, { status: 400 });
  }

  const activeRegs = await prisma.eventRegistration.findMany({
    where: { eventId, status: { in: ["PAID", "PENDING_PAYMENT"] } },
    select: { id: true },
  });

  let cancelled = 0;
  for (const reg of activeRegs) {
    try {
      await cancelEventRegistrationByInstructor({
        registrationId: reg.id,
        instructorId: userId,
      });
      cancelled += 1;
    } catch {
      /* skip if cannot cancel */
    }
  }

  if (event.moderationStatus === "PUBLISHED" || event.moderationStatus === "ARCHIVED") {
    await prisma.instructorEvent.update({
      where: { id: eventId },
      data: { moderationStatus: "ARCHIVED" },
    });
  } else if (event.moderationStatus === "DRAFT" || event.moderationStatus === "REJECTED") {
    await prisma.instructorEvent.delete({ where: { id: eventId } });
    return NextResponse.json({
      ok: true,
      deleted: true,
      cancelledRegistrations: cancelled,
      message: "Черновик удалён, записи отменены",
    });
  }

  return NextResponse.json({
    ok: true,
    archived: true,
    cancelledRegistrations: cancelled,
    message: `Мероприятие скрыто. Отменено записей: ${cancelled}`,
  });
}
