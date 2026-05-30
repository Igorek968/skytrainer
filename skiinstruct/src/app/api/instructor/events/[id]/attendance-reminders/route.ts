import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import {
  countUnconfirmedEventAttendance,
  sendEventAttendanceReminders,
} from "@/lib/services/event-attendance";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id: eventId } = await ctx.params;

  const event = await prisma.instructorEvent.findFirst({
    where: { id: eventId, instructorId: userId },
    select: { id: true, title: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const unconfirmed = await countUnconfirmedEventAttendance(eventId);
  if (unconfirmed === 0) {
    return NextResponse.json({
      message: "Все участники уже подтвердили участие",
      reminded: 0,
    });
  }

  const { reminded, pushSent } = await sendEventAttendanceReminders(eventId);
  return NextResponse.json({
    message: `Напоминания отправлены ${reminded} участникам`,
    reminded,
    pushSent,
  });
}
