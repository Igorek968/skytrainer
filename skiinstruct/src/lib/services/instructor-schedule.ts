import type {
  InstructorEventModerationStatus,
  LessonDuration,
  Order,
  OrderStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { parseWallDateTime } from "@/shared/lib/lesson-wall-datetime";
import { LESSON_TIMES_IN_NOTES } from "@/shared/lib/order-lesson-times";
import {
  EVENT_SCHEDULE_BLOCK_MINUTES,
  LESSON_SCHEDULE_GAP_MINUTES,
  SCHEDULE_GRID_HOUR_END,
  SCHEDULE_GRID_HOUR_START,
  type InstructorPublicBusyWeek,
  type InstructorWeekSchedule,
  type WeekScheduleDay,
  type WeekScheduleHourCell,
} from "@/shared/lib/instructor-schedule-types";

export {
  EVENT_SCHEDULE_BLOCK_MINUTES,
  LESSON_SCHEDULE_GAP_MINUTES,
  SCHEDULE_GRID_HOUR_END,
  SCHEDULE_GRID_HOUR_START,
} from "@/shared/lib/instructor-schedule-types";
export type {
  InstructorPublicBusyDay,
  InstructorPublicBusyWeek,
  InstructorWeekSchedule,
  WeekScheduleDay,
  WeekScheduleHourCell,
} from "@/shared/lib/instructor-schedule-types";

export const SCHEDULE_BLOCKING_STATUSES: OrderStatus[] = [
  "AWAITING_PAYMENT",
  "PENDING_INSTRUCTOR",
  "ACCEPTED",
  "INSTRUCTOR_EN_ROUTE",
  "LESSON_STARTED",
];

/** Мероприятия, которые блокируют вызов на тренировку. */
const EVENT_BOOKING_BLOCK_STATUSES: InstructorEventModerationStatus[] = ["PUBLISHED"];

/** Мероприятия, которые показываем занятыми в календаре инструктора. */
const EVENT_CALENDAR_STATUSES: InstructorEventModerationStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
];

export type DayTimeBlock = {
  ymd: string;
  fromMinutes: number;
  toMinutes: number;
};

type EventBusyBlock = DayTimeBlock & {
  eventId: string;
  title: string;
};

export type ScheduleConflict = {
  ymd: string;
  message: string;
};

export function localYmdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function hmToMinutesLocal(hm: string): number {
  const m = hm.trim().match(/^(\d{2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function addCalendarDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localYmdFromDate(d);
}

function enumerateYmdRange(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  let cur = startYmd;
  while (cur <= endYmd) {
    out.push(cur);
    if (cur === endYmd) break;
    cur = addCalendarDays(cur, 1);
    if (out.length > 40) break;
  }
  return out;
}

/** Блоки занятости по дням из заказа (время из notes — как выбрал клиент). */
export function orderToDayBlocks(
  order: Pick<Order, "requestedStartDate" | "requestedEndDate" | "duration"> & {
    notes?: string | null;
  },
): DayTimeBlock[] {
  if (!order.requestedStartDate) return [];

  const start = order.requestedStartDate;
  const end = order.requestedEndDate ?? start;
  const startYmd = localYmdFromDate(start);
  const endYmd = localYmdFromDate(end);
  const notesMatch = (order.notes ?? "").match(LESSON_TIMES_IN_NOTES);

  let startMin: number;
  let endMin: number;

  if (notesMatch) {
    startMin = hmToMinutesLocal(notesMatch[1]);
    endMin = hmToMinutesLocal(notesMatch[2]);
    if (startYmd === endYmd && endMin <= startMin) {
      const spanMin = Math.round((end.getTime() - start.getTime()) / 60_000);
      if (spanMin > 0) {
        endMin = Math.min(SCHEDULE_GRID_HOUR_END * 60, startMin + spanMin);
      }
    }
  } else {
    startMin = start.getHours() * 60 + start.getMinutes();
    endMin = end.getHours() * 60 + end.getMinutes();
    if (startYmd === endYmd) {
      const spanMin = Math.round((end.getTime() - start.getTime()) / 60_000);
      if (spanMin > 0) {
        endMin = Math.min(SCHEDULE_GRID_HOUR_END * 60, startMin + spanMin);
      }
    }
  }

  const days = enumerateYmdRange(startYmd, endYmd);
  if (!days.length) return [];

  if (days.length === 1) {
    return [{ ymd: startYmd, fromMinutes: startMin, toMinutes: endMin }];
  }

  return days.map((ymd) => {
    if (ymd === startYmd) {
      return { ymd, fromMinutes: startMin, toMinutes: SCHEDULE_GRID_HOUR_END * 60 };
    }
    if (ymd === endYmd) {
      return {
        ymd,
        fromMinutes: SCHEDULE_GRID_HOUR_START * 60,
        toMinutes: endMin,
      };
    }
    return {
      ymd,
      fromMinutes: SCHEDULE_GRID_HOUR_START * 60,
      toMinutes: SCHEDULE_GRID_HOUR_END * 60,
    };
  });
}

/** Расширить блок на час до и после (перерыв между уроками). */
export function expandBlockWithGap(block: DayTimeBlock): DayTimeBlock {
  return {
    ymd: block.ymd,
    fromMinutes: Math.max(0, block.fromMinutes - LESSON_SCHEDULE_GAP_MINUTES),
    toMinutes: Math.min(24 * 60, block.toMinutes + LESSON_SCHEDULE_GAP_MINUTES),
  };
}

function rangesOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && bFrom < aTo;
}

export function blocksConflict(
  a: DayTimeBlock[],
  b: DayTimeBlock[],
  withGap = true,
): ScheduleConflict | null {
  const aExp = withGap ? a.map(expandBlockWithGap) : a;
  const bExp = withGap ? b.map(expandBlockWithGap) : b;
  for (const left of aExp) {
    for (const right of bExp) {
      if (left.ymd !== right.ymd) continue;
      if (rangesOverlap(left.fromMinutes, left.toMinutes, right.fromMinutes, right.toMinutes)) {
        return {
          ymd: left.ymd,
          message: `Часы на ${formatYmdRu(left.ymd)} заняты. Поменяйте часы тренировки.`,
        };
      }
    }
  }
  return null;
}

function formatYmdRu(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export function proposedOrderBlocks(input: {
  lessonDate: string;
  lessonEndDate?: string;
  lessonStartTime: string;
  lessonEndTime: string;
  duration: LessonDuration;
  lessonTimeZoneOffsetMinutes?: number;
}): DayTimeBlock[] {
  const endYmd = input.lessonEndDate ?? input.lessonDate;
  const tz = input.lessonTimeZoneOffsetMinutes ?? 0;
  const startDt = parseWallDateTime(input.lessonDate, input.lessonStartTime, tz);
  const endDt = parseWallDateTime(endYmd, input.lessonEndTime, tz);
  if (!startDt || !endDt) return [];
  return orderToDayBlocks({
    requestedStartDate: startDt,
    requestedEndDate: endDt,
    duration: input.duration,
  });
}

export async function loadInstructorBlockingOrders(
  instructorId: string,
  excludeOrderId?: string,
) {
  return prisma.order.findMany({
    where: {
      instructorId,
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      status: { in: SCHEDULE_BLOCKING_STATUSES },
      requestedStartDate: { not: null },
    },
    select: {
      id: true,
      requestedStartDate: true,
      requestedEndDate: true,
      duration: true,
      status: true,
      notes: true,
      client: { select: { name: true } },
    },
  });
}

/** Старт мероприятия → блок занятости в календаре (длительность по умолчанию). */
export function eventOccurrenceToDayBlock(
  startsAt: Date,
  durationMinutes = EVENT_SCHEDULE_BLOCK_MINUTES,
): DayTimeBlock {
  const ymd = localYmdFromDate(startsAt);
  const fromMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const toMinutes = Math.min(24 * 60, fromMinutes + Math.max(30, durationMinutes));
  return { ymd, fromMinutes, toMinutes };
}

function eventOccurrenceStillActive(startsAt: Date, now = new Date()): boolean {
  return startsAt.getTime() + EVENT_SCHEDULE_BLOCK_MINUTES * 60_000 > now.getTime();
}

async function loadInstructorEventsForSchedule(
  instructorId: string,
  statuses: InstructorEventModerationStatus[],
) {
  return prisma.instructorEvent.findMany({
    where: {
      instructorId,
      moderationStatus: { in: statuses },
    },
    select: {
      id: true,
      title: true,
      eventAt: true,
      slots: {
        select: { id: true, startsAt: true },
        orderBy: { startsAt: "asc" },
      },
    },
  });
}

export function instructorEventsToBusyBlocks(
  events: Array<{
    id: string;
    title: string;
    eventAt: Date | null;
    slots: Array<{ startsAt: Date }>;
  }>,
  opts?: { onlyActive?: boolean; now?: Date },
): EventBusyBlock[] {
  const now = opts?.now ?? new Date();
  const onlyActive = opts?.onlyActive ?? false;
  const out: EventBusyBlock[] = [];

  for (const event of events) {
    const startsList =
      event.slots.length > 0
        ? event.slots.map((s) => s.startsAt)
        : event.eventAt
          ? [event.eventAt]
          : [];
    for (const startsAt of startsList) {
      if (onlyActive && !eventOccurrenceStillActive(startsAt, now)) continue;
      const block = eventOccurrenceToDayBlock(startsAt);
      out.push({
        ...block,
        eventId: event.id,
        title: event.title.trim() || "Мероприятие",
      });
    }
  }
  return out;
}

export async function findInstructorScheduleConflict(params: {
  instructorId: string;
  lessonDate: string;
  lessonEndDate?: string;
  lessonStartTime: string;
  lessonEndTime: string;
  duration: LessonDuration;
  lessonTimeZoneOffsetMinutes?: number;
  excludeOrderId?: string;
}): Promise<ScheduleConflict | null> {
  const proposed = proposedOrderBlocks({
    lessonDate: params.lessonDate,
    lessonEndDate: params.lessonEndDate,
    lessonStartTime: params.lessonStartTime,
    lessonEndTime: params.lessonEndTime,
    duration: params.duration,
    lessonTimeZoneOffsetMinutes: params.lessonTimeZoneOffsetMinutes,
  });
  if (!proposed.length) return null;

  const existing = await loadInstructorBlockingOrders(params.instructorId, params.excludeOrderId);
  for (const o of existing) {
    const blocks = orderToDayBlocks(o);
    const hit = blocksConflict(proposed, blocks);
    if (hit) return hit;
  }

  const events = await loadInstructorEventsForSchedule(
    params.instructorId,
    EVENT_BOOKING_BLOCK_STATUSES,
  );
  const eventBlocks = instructorEventsToBusyBlocks(events, { onlyActive: true });
  for (const eb of eventBlocks) {
    const hit = blocksConflict(proposed, [eb]);
    if (hit) {
      return {
        ymd: hit.ymd,
        message: `В это время у инструктора мероприятие «${eb.title}». Выберите другое время.`,
      };
    }
  }
  return null;
}

const WEEKDAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function minutesToHm(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function mondayOfWeekContaining(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localYmdFromDate(d);
}

function hourCellBusy(
  ymd: string,
  hour: number,
  expandedOrders: Array<DayTimeBlock & { orderId: string }>,
  expandedEvents: Array<DayTimeBlock & { eventId: string }>,
): { busy: boolean; orderIds: string[]; eventIds: string[] } {
  const from = hour * 60;
  const to = (hour + 1) * 60;
  const orderIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const b of expandedOrders) {
    if (b.ymd !== ymd) continue;
    if (rangesOverlap(from, to, b.fromMinutes, b.toMinutes)) {
      orderIds.add(b.orderId);
    }
  }
  for (const b of expandedEvents) {
    if (b.ymd !== ymd) continue;
    if (rangesOverlap(from, to, b.fromMinutes, b.toMinutes)) {
      eventIds.add(b.eventId);
    }
  }
  return {
    busy: orderIds.size > 0 || eventIds.size > 0,
    orderIds: [...orderIds],
    eventIds: [...eventIds],
  };
}

export function buildInstructorWeekSchedule(
  weekStartYmd: string,
  orders: Array<
    Pick<Order, "id" | "requestedStartDate" | "requestedEndDate" | "duration" | "status"> & {
      client?: { name: string | null } | null;
    }
  >,
  eventBlocks: EventBusyBlock[] = [],
): InstructorWeekSchedule {
  const weekEndYmd = addCalendarDays(weekStartYmd, 6);
  const expandedOrders: Array<DayTimeBlock & { orderId: string }> = [];
  const expandedEvents: Array<DayTimeBlock & { eventId: string }> = [];
  const lessons: InstructorWeekSchedule["lessons"] = [];
  const events: InstructorWeekSchedule["events"] = [];

  for (const o of orders) {
    if (!o.requestedStartDate) continue;
    const raw = orderToDayBlocks(o);
    for (const b of raw) {
      expandedOrders.push({ ...expandBlockWithGap(b), orderId: o.id });
      lessons.push({
        orderId: o.id,
        ymd: b.ymd,
        fromHm: minutesToHm(b.fromMinutes),
        toHm: minutesToHm(b.toMinutes),
        clientName: o.client?.name ?? null,
        status: o.status,
      });
    }
  }

  for (const eb of eventBlocks) {
    if (eb.ymd < weekStartYmd || eb.ymd > weekEndYmd) continue;
    // Мероприятие блокирует слот целиком; 1 ч перерыв — как у уроков.
    expandedEvents.push({ ...expandBlockWithGap(eb), eventId: eb.eventId });
    events.push({
      eventId: eb.eventId,
      ymd: eb.ymd,
      fromHm: minutesToHm(eb.fromMinutes),
      toHm: minutesToHm(eb.toMinutes),
      title: eb.title,
    });
  }

  const days: WeekScheduleDay[] = [];
  for (let i = 0; i < 7; i++) {
    const ymd = addCalendarDays(weekStartYmd, i);
    const d = new Date(`${ymd}T12:00:00`);
    const weekday = d.getDay();
    const hours: WeekScheduleHourCell[] = [];
    for (let hour = SCHEDULE_GRID_HOUR_START; hour < SCHEDULE_GRID_HOUR_END; hour++) {
      const cell = hourCellBusy(ymd, hour, expandedOrders, expandedEvents);
      hours.push({
        hour,
        busy: cell.busy,
        orderIds: cell.orderIds,
        eventIds: cell.eventIds,
      });
    }
    days.push({
      ymd,
      weekday,
      label: `${WEEKDAY_LABELS[weekday]} ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`,
      hours,
    });
  }

  return { weekStartYmd, weekEndYmd, days, lessons, events };
}

export async function getInstructorWeekSchedule(
  instructorId: string,
  anchorYmd?: string,
): Promise<InstructorWeekSchedule> {
  const weekStartYmd = mondayOfWeekContaining(anchorYmd ?? localYmdFromDate(new Date()));
  const weekEndYmd = addCalendarDays(weekStartYmd, 6);
  const all = await loadInstructorBlockingOrders(instructorId);
  const orders = all.filter((o) => {
    const blocks = orderToDayBlocks(o);
    return blocks.some((b) => b.ymd >= weekStartYmd && b.ymd <= weekEndYmd);
  });
  const eventRows = await loadInstructorEventsForSchedule(instructorId, EVENT_CALENDAR_STATUSES);
  const eventBlocks = instructorEventsToBusyBlocks(eventRows).filter(
    (b) => b.ymd >= weekStartYmd && b.ymd <= weekEndYmd,
  );
  return buildInstructorWeekSchedule(weekStartYmd, orders, eventBlocks);
}

/** Склеить занятые часы сетки в интервалы (без id заказов / имён клиентов). */
export function busyRangesFromHourCells(
  hours: WeekScheduleHourCell[],
): Array<{ from: string; to: string }> {
  const busyHours = hours
    .filter((h) => h.busy)
    .map((h) => h.hour)
    .sort((a, b) => a - b);
  const ranges: Array<{ from: string; to: string }> = [];
  let start: number | null = null;
  let prev: number | null = null;
  for (const hour of busyHours) {
    if (start === null || prev === null) {
      start = hour;
      prev = hour;
      continue;
    }
    if (hour === prev + 1) {
      prev = hour;
      continue;
    }
    ranges.push({ from: minutesToHm(start * 60), to: minutesToHm((prev + 1) * 60) });
    start = hour;
    prev = hour;
  }
  if (start !== null && prev !== null) {
    ranges.push({ from: minutesToHm(start * 60), to: minutesToHm((prev + 1) * 60) });
  }
  return ranges;
}

/** Публичная занятость на неделю — только интервалы, без персональных данных учеников. */
export async function getInstructorPublicBusyWeek(
  instructorId: string,
  anchorYmd?: string,
): Promise<InstructorPublicBusyWeek> {
  const schedule = await getInstructorWeekSchedule(instructorId, anchorYmd);
  return {
    weekStartYmd: schedule.weekStartYmd,
    weekEndYmd: schedule.weekEndYmd,
    days: schedule.days.map((d) => ({
      ymd: d.ymd,
      weekday: d.weekday,
      label: d.label,
      busyRanges: busyRangesFromHourCells(d.hours),
    })),
  };
}

export async function cancelInstructorDayOrders(params: {
  instructorId: string;
  lessonDateYmd: string;
  actorUserId: string;
}): Promise<{ cancelledIds: string[] }> {
  const { cancelOrderWithRefund } = await import("@/lib/services/order-refund");
  const orders = await loadInstructorBlockingOrders(params.instructorId);
  const cancelledIds: string[] = [];
  for (const o of orders) {
    const blocks = orderToDayBlocks(o);
    if (!blocks.some((b) => b.ymd === params.lessonDateYmd)) continue;
    await cancelOrderWithRefund({
      orderId: o.id,
      actorUserId: params.actorUserId,
      cancelledBy: "INSTRUCTOR",
    });
    cancelledIds.push(o.id);
  }
  return { cancelledIds };
}
