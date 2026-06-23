import type { Prisma } from "@prisma/client";

import { isInstructorEventCompleted, type ClientInstructorEventDTO } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { spawnDailyRepeatsForExpiringEvents, isSlotEventPast } from "@/lib/services/instructor-event-daily-repeat";

/** Опубликованные мероприятия с датой в будущем или без даты — для ленты клиента. */
export function activePublishedEventWhere(now: Date = new Date()): Prisma.InstructorEventWhereInput {
  return {
    moderationStatus: "PUBLISHED",
    OR: [{ eventAt: null }, { eventAt: { gt: now } }],
  };
}

/** Не показывать в клиентской ленте (прошло по дате/времени или не опубликовано). */
export function isVisibleInClientEventFeed(
  event: Pick<ClientInstructorEventDTO, "moderationStatus" | "isCompleted" | "eventAt">,
  now: Date = new Date(),
): boolean {
  if (event.moderationStatus !== "PUBLISHED") return false;
  if (event.isCompleted) return false;
  if (event.eventAt && isInstructorEventCompleted(event.eventAt, now)) return false;
  return true;
}

/**
 * Прошедшие по дате/времени опубликованные мероприятия → ARCHIVED (скрыты из ленты, у инструктора «Выполнено»).
 */
export async function archivePastPublishedInstructorEvents(options?: {
  instructorId?: string;
  now?: Date;
}): Promise<{ archived: number; spawned: number }> {
  const now = options?.now ?? new Date();

  const spawned = await spawnDailyRepeatsForExpiringEvents(options);

  const result = await prisma.instructorEvent.updateMany({
    where: {
      moderationStatus: "PUBLISHED",
      eventAt: { not: null, lte: now },
      ...(options?.instructorId ? { instructorId: options.instructorId } : {}),
    },
    data: { moderationStatus: "ARCHIVED" },
  });

  const slotCandidates = await prisma.instructorEvent.findMany({
    where: {
      moderationStatus: "PUBLISHED",
      eventAt: null,
      slots: { some: { startsAt: { lte: now } } },
      ...(options?.instructorId ? { instructorId: options.instructorId } : {}),
    },
    include: { slots: true },
  });

  let slotArchived = 0;
  for (const ev of slotCandidates) {
    if (!isSlotEventPast(ev, now)) continue;
    await prisma.instructorEvent.update({
      where: { id: ev.id },
      data: { moderationStatus: "ARCHIVED" },
    });
    slotArchived += 1;
  }

  return { archived: result.count + slotArchived, spawned };
}
