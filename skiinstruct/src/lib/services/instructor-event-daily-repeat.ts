import type { EventSlot, InstructorEvent } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type EventWithSlots = InstructorEvent & { slots: EventSlot[] };

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Событие с выходами считается прошедшим, когда все слоты в прошлом. */
export function isSlotEventPast(
  event: Pick<InstructorEvent, "eventAt"> & { slots: EventSlot[] },
  now: Date,
): boolean {
  if (event.slots.length > 0) {
    return event.slots.every((s) => s.startsAt.getTime() <= now.getTime());
  }
  if (!event.eventAt) return false;
  return event.eventAt.getTime() <= now.getTime();
}

/**
 * Сколько суток сдвинуть, чтобы событие снова было в будущем.
 * Минимум 1, если уже прошло.
 */
function daysToRollForward(event: EventWithSlots, now: Date): number {
  if (!isSlotEventPast(event, now)) return 0;

  if (event.slots.length > 0) {
    const latest = event.slots.reduce(
      (max, s) => (s.startsAt > max ? s.startsAt : max),
      event.slots[0]!.startsAt,
    );
    let days = 1;
    let probe = addDays(latest, 1);
    while (probe.getTime() <= now.getTime() && days < 370) {
      days += 1;
      probe = addDays(latest, days);
    }
    return days;
  }

  if (event.eventAt) {
    let days = 1;
    let probe = addDays(event.eventAt, 1);
    while (probe.getTime() <= now.getTime() && days < 370) {
      days += 1;
      probe = addDays(event.eventAt, days);
    }
    return days;
  }

  return 0;
}

/**
 * Сдвигает дату/время того же события на N суток вперёд (без создания копии).
 * Сбрасывает флаги напоминаний, чтобы push снова отработали.
 */
export async function rollForwardDailyRepeatEvent(
  source: EventWithSlots,
  now: Date = new Date(),
): Promise<boolean> {
  if (!source.repeatDaily) return false;
  if (source.moderationStatus !== "PUBLISHED") return false;

  const days = daysToRollForward(source, now);
  if (days <= 0) return false;

  if (source.slots.length > 0) {
    for (const slot of source.slots) {
      await prisma.eventSlot.update({
        where: { id: slot.id },
        data: {
          startsAt: addDays(slot.startsAt, days),
          startReminderSentAt: null,
        },
      });
    }
    const refreshed = await prisma.eventSlot.findMany({
      where: { eventId: source.id },
      select: { startsAt: true },
    });
    const maxAt = refreshed.reduce(
      (max, s) => Math.max(max, s.startsAt.getTime()),
      0,
    );
    await prisma.instructorEvent.update({
      where: { id: source.id },
      data: {
        eventAt: maxAt > 0 ? new Date(maxAt) : source.eventAt,
        startReminderSentAt: null,
        moderationStatus: "PUBLISHED",
      },
    });
    return true;
  }

  if (source.eventAt) {
    await prisma.instructorEvent.update({
      where: { id: source.id },
      data: {
        eventAt: addDays(source.eventAt, days),
        startReminderSentAt: null,
        moderationStatus: "PUBLISHED",
      },
    });
    return true;
  }

  return false;
}

/**
 * Для прошедших PUBLISHED с галочкой «автовыкладывание» — обновить дату на том же id
 * (обычно срабатывает после полуночи через cron expire-events / при открытии ленты).
 */
export async function rollForwardDailyRepeatEvents(options?: {
  instructorId?: string;
  now?: Date;
}): Promise<number> {
  const now = options?.now ?? new Date();

  const candidates = await prisma.instructorEvent.findMany({
    where: {
      repeatDaily: true,
      moderationStatus: "PUBLISHED",
      ...(options?.instructorId ? { instructorId: options.instructorId } : {}),
    },
    include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
  });

  let rolled = 0;
  for (const ev of candidates) {
    if (await rollForwardDailyRepeatEvent(ev, now)) rolled += 1;
  }
  return rolled;
}
