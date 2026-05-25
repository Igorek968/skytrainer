import type { Prisma } from "@prisma/client";

import { isInstructorEventCompleted, type ClientInstructorEventDTO } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

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
}): Promise<number> {
  const now = options?.now ?? new Date();

  const result = await prisma.instructorEvent.updateMany({
    where: {
      moderationStatus: "PUBLISHED",
      eventAt: { not: null, lte: now },
      ...(options?.instructorId ? { instructorId: options.instructorId } : {}),
    },
    data: { moderationStatus: "ARCHIVED" },
  });

  return result.count;
}
