import type { EventSlot, InstructorEvent, Prisma } from "@prisma/client";

import { isInstructorEventCompleted, formatSlotTimeRu } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

import {
  isEventFree,
  serializeEventRegistration,
  type EventRegistrationSummary,
} from "./event-registration";

export type EventSlotInput = {
  id?: string;
  /** YYYY-MM-DD — день этого выхода (если нет, берётся eventDay) */
  date?: string | null;
  /** HH:mm */
  time: string;
  /** Название выхода / дня */
  title?: string | null;
  maxSeats?: number | null;
  priceRub?: number | null;
};

export type EventSlotDTO = {
  id: string;
  startsAt: string;
  title: string | null;
  maxSeats: number | null;
  priceRub: number | null;
  sortOrder: number;
  paidCount: number;
  spotsLeft: number | null;
  isFull: boolean;
  isCompleted: boolean;
  registrationOpen: boolean;
  isFree: boolean;
  myRegistration: EventRegistrationSummary | null;
};

export function eventUsesSlots(slots: { id: string }[] | number): boolean {
  return typeof slots === "number" ? slots > 0 : slots.length > 0;
}

export function parseEventDayYmd(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function buildSlotStartsAt(eventDay: Date, timeHm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeHm.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const d = new Date(eventDay);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function slotRegistrationKey(slotId: string, clientId: string): string {
  return `${slotId}:${clientId}`;
}

export function legacyEventRegistrationKey(eventId: string, clientId: string): string {
  return `${eventId}:${clientId}`;
}

export async function countActiveSlotRegistrations(slotId: string): Promise<number> {
  return prisma.eventRegistration.count({
    where: { slotId, status: { in: ["PAID", "PENDING_PAYMENT"] } },
  });
}

export async function getSlotCapacityState(slot: Pick<EventSlot, "id" | "maxSeats">) {
  const paidCount = await countActiveSlotRegistrations(slot.id);
  const spotsLeft =
    slot.maxSeats != null ? Math.max(0, slot.maxSeats - paidCount) : null;
  const isFull = slot.maxSeats != null && paidCount >= slot.maxSeats;
  return { paidCount, spotsLeft, isFull };
}

export function slotRegistrationOpen(
  slot: Pick<EventSlot, "startsAt">,
  event: Pick<InstructorEvent, "moderationStatus">,
  isFull: boolean,
): boolean {
  if (event.moderationStatus !== "PUBLISHED") return false;
  if (isInstructorEventCompleted(slot.startsAt)) return false;
  if (isFull) return false;
  return true;
}

export function computeEventAtFromSlots(slots: Pick<EventSlot, "startsAt">[]): Date | null {
  if (!slots.length) return null;
  let max = slots[0]!.startsAt.getTime();
  for (const s of slots) {
    max = Math.max(max, s.startsAt.getTime());
  }
  return new Date(max);
}

function normalizeSlotTitle(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? "";
  return t.length ? t.slice(0, 80) : null;
}

export async function syncEventSlots(
  eventId: string,
  eventDay: Date | null,
  inputs: EventSlotInput[],
): Promise<EventSlot[]> {
  const normalized = inputs
    .map((row, index) => {
      const day = parseEventDayYmd(row.date) ?? eventDay;
      if (!day) return null;
      const startsAt = buildSlotStartsAt(day, row.time);
      if (!startsAt) return null;
      return {
        id: row.id?.trim() || undefined,
        startsAt,
        title: normalizeSlotTitle(row.title),
        maxSeats: row.maxSeats ?? null,
        priceRub: row.priceRub ?? null,
        sortOrder: index,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (!normalized.length) {
    throw new Error("Добавьте хотя бы один выход с датой и временем");
  }

  const existing = await prisma.eventSlot.findMany({
    where: { eventId },
    select: { id: true },
  });
  const keepIds = new Set(normalized.map((s) => s.id).filter(Boolean) as string[]);

  const toDelete = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
  if (toDelete.length) {
    const blocked = await prisma.eventRegistration.count({
      where: {
        slotId: { in: toDelete },
        status: { in: ["PAID", "PENDING_PAYMENT"] },
      },
    });
    if (blocked > 0) {
      throw new Error("Нельзя удалить выход с активными записями");
    }
    await prisma.eventSlot.deleteMany({ where: { id: { in: toDelete } } });
  }

  const result: EventSlot[] = [];
  for (const row of normalized) {
    if (row.id) {
      const updated = await prisma.eventSlot.update({
        where: { id: row.id },
        data: {
          startsAt: row.startsAt,
          title: row.title,
          maxSeats: row.maxSeats,
          priceRub: row.priceRub,
          sortOrder: row.sortOrder,
        },
      });
      result.push(updated);
    } else {
      const created = await prisma.eventSlot.create({
        data: {
          eventId,
          startsAt: row.startsAt,
          title: row.title,
          maxSeats: row.maxSeats,
          priceRub: row.priceRub,
          sortOrder: row.sortOrder,
        },
      });
      result.push(created);
    }
  }

  const eventAt = computeEventAtFromSlots(result);
  await prisma.instructorEvent.update({
    where: { id: eventId },
    data: { eventAt },
  });

  return result.sort((a, b) => a.sortOrder - b.sortOrder || a.startsAt.getTime() - b.startsAt.getTime());
}

export async function serializeEventSlot(
  slot: EventSlot,
  event: Pick<InstructorEvent, "moderationStatus">,
  myRegistration: {
    id: string;
    status: import("@prisma/client").EventRegistrationStatus;
    amountRub: Prisma.Decimal | number;
    paidAt: Date | null;
    attendanceConfirmedAt?: Date | null;
  } | null,
): Promise<EventSlotDTO> {
  const { paidCount, spotsLeft, isFull } = await getSlotCapacityState(slot);
  const isCompleted = isInstructorEventCompleted(slot.startsAt);
  return {
    id: slot.id,
    startsAt: slot.startsAt.toISOString(),
    title: slot.title ?? null,
    maxSeats: slot.maxSeats,
    priceRub: slot.priceRub,
    sortOrder: slot.sortOrder,
    paidCount,
    spotsLeft,
    isFull,
    isCompleted,
    registrationOpen: slotRegistrationOpen(slot, event, isFull),
    isFree: isEventFree(slot.priceRub),
    myRegistration: myRegistration
      ? serializeEventRegistration({
          ...myRegistration,
          eventAt: slot.startsAt,
        })
      : null,
  };
}

export async function loadEventSlotsForClient(
  event: InstructorEvent & { slots?: EventSlot[] },
  clientId: string | null,
): Promise<EventSlotDTO[]> {
  const slots =
    event.slots ??
    (await prisma.eventSlot.findMany({
      where: { eventId: event.id },
      orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
    }));

  if (!slots.length) return [];

  const myRegs = clientId
    ? await prisma.eventRegistration.findMany({
        where: { eventId: event.id, clientId, slotId: { in: slots.map((s) => s.id) } },
      })
    : [];

  const regBySlot = new Map(myRegs.map((r) => [r.slotId!, r]));

  return Promise.all(
    slots.map((slot) => serializeEventSlot(slot, event, regBySlot.get(slot.id) ?? null)),
  );
}

export function eventDayFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function slotsToFormInputs(slots: EventSlot[]): EventSlotInput[] {
  return slots.map((s) => ({
    id: s.id,
    date: eventDayFromIso(s.startsAt.toISOString()),
    time: formatSlotTimeRu(s.startsAt),
    title: s.title ?? null,
    maxSeats: s.maxSeats,
    priceRub: s.priceRub,
  }));
}
