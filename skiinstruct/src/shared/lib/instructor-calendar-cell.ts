import type { WeekScheduleHourCell } from "@/shared/lib/instructor-schedule-types";
import {
  hourInAvailabilityTemplate,
  hmToMinutes,
  type AvailabilitySlot,
} from "@/shared/lib/instructor-availability-slots";

export type CalendarCellKind = "outside" | "available" | "buffer" | "lesson" | "event";

export type CalendarCellVisual = {
  kind: CalendarCellKind;
  orderIds: string[];
  eventIds: string[];
};

function rangesOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && bFrom < aTo;
}

function hourOverlapsLesson(
  hour: number,
  fromHm: string,
  toHm: string,
): boolean {
  const cellFrom = hour * 60;
  const cellTo = (hour + 1) * 60;
  return rangesOverlap(cellFrom, cellTo, hmToMinutes(fromHm), hmToMinutes(toHm));
}

/** Визуальное состояние ячейки: шаблон доступности + занятость из заказов и событий. */
export function resolveCalendarCellVisual(input: {
  weekday: number;
  hour: number;
  scheduleCell: WeekScheduleHourCell | undefined;
  availabilitySlots: AvailabilitySlot[];
  lessonsOnDay: Array<{ orderId: string; fromHm: string; toHm: string }>;
  eventsOnDay?: Array<{ eventId: string; fromHm: string; toHm: string }>;
}): CalendarCellVisual {
  const orderIds = input.scheduleCell?.orderIds ?? [];
  const eventIds = input.scheduleCell?.eventIds ?? [];
  const inTemplate = hourInAvailabilityTemplate(
    input.weekday,
    input.hour,
    input.availabilitySlots,
  );

  if (!orderIds.length && !eventIds.length) {
    return { kind: inTemplate ? "available" : "outside", orderIds: [], eventIds: [] };
  }

  const isEvent = (input.eventsOnDay ?? []).some(
    (e) => eventIds.includes(e.eventId) && hourOverlapsLesson(input.hour, e.fromHm, e.toHm),
  );
  if (isEvent) {
    return { kind: "event", orderIds, eventIds };
  }

  if (!orderIds.length) {
    return { kind: "buffer", orderIds: [], eventIds };
  }

  const isLesson = input.lessonsOnDay.some(
    (l) => orderIds.includes(l.orderId) && hourOverlapsLesson(input.hour, l.fromHm, l.toHm),
  );

  return { kind: isLesson ? "lesson" : "buffer", orderIds, eventIds };
}

export const CALENDAR_CELL_CLASS: Record<CalendarCellKind, string> = {
  outside: "bg-muted/60 dark:bg-muted/40",
  available: "bg-emerald-100/90 dark:bg-emerald-950/50 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/50",
  buffer: "bg-amber-400/75 dark:bg-amber-700/70",
  lesson: "bg-red-500/90 dark:bg-red-700/85 hover:bg-red-600/90 cursor-pointer",
  event: "bg-violet-500/90 dark:bg-violet-700/85 hover:bg-violet-600/90 cursor-pointer",
};
