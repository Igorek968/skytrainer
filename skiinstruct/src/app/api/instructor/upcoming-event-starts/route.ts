import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { START_REMINDER_MAX_MS } from "@/lib/reminder-timing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Ближайшие старты событий инструктора (для in-app напоминания за ~1 ч).
 */
export async function GET() {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const now = Date.now();
  const horizon = new Date(now + START_REMINDER_MAX_MS + 5 * 60_000);

  const [events, slots] = await Promise.all([
    prisma.instructorEvent.findMany({
      where: {
        instructorId: userId,
        moderationStatus: "PUBLISHED",
        eventAt: { gte: new Date(now - 60_000), lte: horizon },
        slots: { none: {} },
      },
      select: { id: true, title: true, eventAt: true },
      take: 20,
    }),
    prisma.eventSlot.findMany({
      where: {
        startsAt: { gte: new Date(now - 60_000), lte: horizon },
        event: { instructorId: userId, moderationStatus: "PUBLISHED" },
      },
      select: {
        id: true,
        startsAt: true,
        event: { select: { id: true, title: true } },
      },
      take: 40,
    }),
  ]);

  const items = [
    ...events
      .filter((e) => e.eventAt)
      .map((e) => ({
        key: e.id,
        eventId: e.id,
        slotId: null as string | null,
        title: e.title,
        startsAt: e.eventAt!.toISOString(),
      })),
    ...slots.map((s) => ({
      key: `${s.event.id}:${s.id}`,
      eventId: s.event.id,
      slotId: s.id,
      title: s.event.title,
      startsAt: s.startsAt.toISOString(),
    })),
  ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return NextResponse.json({ items });
}
