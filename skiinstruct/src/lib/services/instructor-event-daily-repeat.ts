import type { EventSlot, InstructorEvent } from "@prisma/client";

import { formatSlotTimeRu } from "@/lib/instructor-events";
import { duplicatePublicUploadForEvent } from "@/lib/public-uploads";
import { prisma } from "@/lib/prisma";

import { syncEventSlots, type EventSlotInput } from "./event-slots";

type EventWithSlots = InstructorEvent & { slots: EventSlot[] };

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isSameInstant(a: Date, b: Date, toleranceMs = 60_000): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= toleranceMs;
}

/** Мероприятие с выходами считается прошедшим, когда все слоты в прошлом. */
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

function nextDayFromEvent(source: EventWithSlots): {
  nextEventAt: Date | null;
  nextDay: Date | null;
  slotInputs: EventSlotInput[];
} {
  if (source.slots.length > 0) {
    const firstSlot = source.slots.reduce(
      (min, s) => (s.startsAt < min.startsAt ? s : min),
      source.slots[0]!,
    );
    const eventDay = startOfLocalDay(firstSlot.startsAt);
    const nextDay = addDays(eventDay, 1);
    const slotInputs = source.slots.map((s) => ({
      time: formatSlotTimeRu(s.startsAt),
      maxSeats: s.maxSeats,
      priceRub: s.priceRub,
    }));
    return { nextEventAt: null, nextDay, slotInputs };
  }
  if (source.eventAt) {
    const nextEventAt = addDays(source.eventAt, 1);
    return { nextEventAt, nextDay: startOfLocalDay(nextEventAt), slotInputs: [] };
  }
  return { nextEventAt: null, nextDay: null, slotInputs: [] };
}

async function dailyCopyExists(
  source: EventWithSlots,
  nextEventAt: Date | null,
  nextDay: Date | null,
): Promise<boolean> {
  if (nextEventAt) {
    const rows = await prisma.instructorEvent.findMany({
      where: {
        instructorId: source.instructorId,
        title: source.title,
        moderationStatus: "PUBLISHED",
        eventAt: { not: null, gte: startOfLocalDay(nextEventAt), lte: endOfLocalDay(nextEventAt) },
      },
      select: { eventAt: true },
    });
    return rows.some((r) => r.eventAt && isSameInstant(r.eventAt, nextEventAt));
  }

  if (nextDay && source.slots.length > 0) {
    const dayEnd = endOfLocalDay(nextDay);
    const slot = await prisma.eventSlot.findFirst({
      where: {
        event: {
          instructorId: source.instructorId,
          title: source.title,
          moderationStatus: "PUBLISHED",
        },
        startsAt: { gte: nextDay, lte: dayEnd },
      },
      select: { id: true },
    });
    return Boolean(slot);
  }

  return false;
}

/** Создаёт опубликованную копию на следующий день, если её ещё нет. */
export async function spawnNextDailyEventIfMissing(source: EventWithSlots): Promise<string | null> {
  const { nextEventAt, nextDay, slotInputs } = nextDayFromEvent(source);
  if (!nextEventAt && !nextDay) return null;

  if (await dailyCopyExists(source, nextEventAt, nextDay)) return null;

  const now = new Date();
  const created = await prisma.instructorEvent.create({
    data: {
      instructorId: source.instructorId,
      titleId: source.titleId,
      title: source.title,
      body: source.body,
      category: source.category,
      catalogItemId: source.catalogItemId,
      orderId: source.orderId,
      eventAt: nextEventAt,
      priceRub: source.priceRub,
      maxRegistrations: source.maxRegistrations,
      moderationStatus: "PUBLISHED",
      publishedAt: now,
      repeatDaily: true,
      venueAddress: source.venueAddress,
      venueLat: source.venueLat,
      venueLng: source.venueLng,
    },
  });

  if (source.photoUrl) {
    const photoUrl = await duplicatePublicUploadForEvent(source.photoUrl, created.id);
    if (photoUrl) {
      await prisma.instructorEvent.update({ where: { id: created.id }, data: { photoUrl } });
    }
  }

  if (nextDay && slotInputs.length) {
    await syncEventSlots(created.id, nextDay, slotInputs);
  }

  return created.id;
}

/** Для включённого repeatDaily — сразу создать копию на следующий день (если ещё нет). */
export async function ensureUpcomingDailyCopy(source: EventWithSlots): Promise<string | null> {
  if (!source.repeatDaily) return null;
  return spawnNextDailyEventIfMissing(source);
}

/** Перед архивацией: для прошедших repeatDaily создать копию на следующий день. */
export async function spawnDailyRepeatsForExpiringEvents(options?: {
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

  let spawned = 0;
  for (const ev of candidates) {
    if (!isSlotEventPast(ev, now)) continue;
    const id = await spawnNextDailyEventIfMissing(ev);
    if (id) spawned += 1;
  }
  return spawned;
}
