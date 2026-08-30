import type {
  EventRegistrationStatus,
  EventSlot,
  InstructorEvent,
  InstructorEventModerationStatus,
} from "@prisma/client";

import {
  getEventCapacityState,
  isEventFree,
  registrationOpenForEvent,
  serializeEventRegistration,
  type EventRegistrationSummary,
} from "@/lib/services/event-registration";
import {
  eventUsesSlots,
  eventDayFromIso,
  loadEventSlotsForClient,
  type EventSlotDTO,
} from "@/lib/services/event-slots";
import { prisma } from "@/lib/prisma";
export type InstructorEventDTO = {
  id: string;
  title: string;
  titleId: string | null;
  /** Привязка к карточке каталога (группировка в ленте). */
  catalogItemId: string | null;
  body: string;
  category: string | null;
  photoUrl: string | null;
  eventAt: string | null;
  moderationStatus: InstructorEventModerationStatus;
  rejectNote: string | null;
  orderId: string | null;
  priceRub: number | null;
  maxRegistrations: number | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
  /** По дате/времени события */
  isCompleted: boolean;
  canEdit: boolean;
  /** Только для инструктора */
  paidRegistrationCount?: number;
  registrationRevenueRub?: number;
  unconfirmedAttendanceCount?: number;
  /** Автовыкладывание: после окончания дата сдвигается на этом же событии */
  repeatDaily?: boolean;
  /** Место проведения */
  venueAddress?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  slots?: EventSlotDTO[];
  hasSlots?: boolean;
  eventDay?: string | null;
};

export type InstructorEventSlotForm = {
  id?: string;
  date?: string | null;
  time: string;
  title?: string | null;
  maxSeats: number | null;
  priceRub: number | null;
};

export type ClientInstructorEventDTO = InstructorEventDTO & {
  instructorId: string;
  instructorName?: string | null;
  /** Средний рейтинг инструктора (для меток на карте). */
  instructorRatingAvg?: number | null;
  /** Расстояние от точки клиента на карте до инструктора, км */
  distanceKm?: number;
  paidRegistrationCount: number;
  spotsLeft: number | null;
  registrationOpen: boolean;
  isFree: boolean;
  myRegistration: EventRegistrationSummary | null;
  slots: EventSlotDTO[];
  hasSlots: boolean;
};

export function isInstructorEventCompleted(
  eventAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!eventAt) return false;
  const t = eventAt instanceof Date ? eventAt.getTime() : new Date(eventAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= now.getTime();
}

export function canEditInstructorEvent(row: {
  eventAt: Date | null;
  moderationStatus: InstructorEventModerationStatus;
}): boolean {
  if (row.moderationStatus === "ARCHIVED") return false;
  if (row.moderationStatus === "PUBLISHED" || row.moderationStatus === "PENDING_REVIEW") {
    return false;
  }
  if (isInstructorEventCompleted(row.eventAt)) return false;
  return row.moderationStatus === "DRAFT" || row.moderationStatus === "REJECTED";
}

/** Обложку можно менять и у опубликованного (пока дата не прошла). */
export function canEditInstructorEventPhoto(row: {
  eventAt: Date | null;
  moderationStatus: InstructorEventModerationStatus;
}): boolean {
  if (row.moderationStatus === "ARCHIVED") return false;
  if (isInstructorEventCompleted(row.eventAt)) return false;
  return (
    row.moderationStatus === "DRAFT" ||
    row.moderationStatus === "REJECTED" ||
    row.moderationStatus === "PUBLISHED"
  );
}

/** Скрытое событие можно вернуть в черновик (редактировать / отправить на модерацию). */
export function canRestoreArchivedEvent(
  row: Pick<InstructorEventDTO, "moderationStatus" | "isCompleted" | "paidRegistrationCount">,
): boolean {
  if (row.moderationStatus !== "ARCHIVED") return false;
  if (row.isCompleted) return false;
  if (row.paidRegistrationCount != null && row.paidRegistrationCount > 0) return false;
  return true;
}

export function showEventCardEdit(ev: InstructorEventDTO): boolean {
  return ev.canEdit || canRestoreArchivedEvent(ev);
}

export function showEventCardModeration(ev: InstructorEventDTO): boolean {
  return (ev.canEdit || canRestoreArchivedEvent(ev)) && Boolean(ev.eventAt || ev.hasSlots);
}

/** Сообщение, если нет даты/времени (классика) и нет выходов со слотами. */
export const EVENT_SCHEDULE_REQUIRED_MESSAGE =
  "Укажите дату и время события — без них нельзя сохранить и отправить на модерацию";

/** Есть расписание: дата/время eventAt или хотя бы один выход (слот). */
export function instructorEventHasSchedule(input: {
  eventAt: Date | string | null | undefined;
  slotsCount?: number;
}): boolean {
  if ((input.slotsCount ?? 0) > 0) return true;
  if (input.eventAt == null || input.eventAt === "") return false;
  if (input.eventAt instanceof Date) return Number.isFinite(input.eventAt.getTime());
  const t = Date.parse(input.eventAt);
  return Number.isFinite(t);
}

/** Скрыть опубликованное из ленты (без безвозвратного удаления). */
export function showEventCardHide(ev: InstructorEventDTO): boolean {
  return ev.moderationStatus === "PUBLISHED" && !ev.isCompleted;
}

/** Безвозвратное удаление (у опубликованного — только без оплаченных записей). */
export function showEventCardDelete(ev: InstructorEventDTO): boolean {
  if (ev.moderationStatus === "PUBLISHED" && !ev.isCompleted) {
    return (ev.paidRegistrationCount ?? 0) === 0;
  }
  if (ev.moderationStatus === "PUBLISHED" && ev.isCompleted) return true;
  if (ev.moderationStatus === "PENDING_REVIEW") return true;
  if (ev.canEdit) return true;
  if (canRestoreArchivedEvent(ev)) return true;
  if (ev.moderationStatus === "ARCHIVED" && ev.isCompleted) return true;
  return false;
}

export function eventCardDeleteLabel(_ev: InstructorEventDTO): string {
  return "Удалить событие";
}

/** Завершённое по дате — удаление с проверкой подтверждений участников. */
export function isCompletedEventPermanentDelete(ev: InstructorEventDTO): boolean {
  return ev.isCompleted && (ev.moderationStatus === "ARCHIVED" || ev.moderationStatus === "PUBLISHED");
}

export function moderationStatusLabel(status: InstructorEventModerationStatus): string {
  switch (status) {
    case "DRAFT":
      return "Черновик";
    case "PENDING_REVIEW":
      return "На модерации";
    case "PUBLISHED":
      return "Опубликовано";
    case "REJECTED":
      return "Отклонено";
    case "ARCHIVED":
      return "Скрыто";
    default:
      return status;
  }
}

export function registrationStatusLabel(status: EventRegistrationStatus): string {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Ожидает оплаты";
    case "PAID":
      return "Оплачено";
    case "CANCELLED":
      return "Отменена";
    default:
      return status;
  }
}

export function serializeInstructorEvent(
  row: InstructorEvent,
  extra?: {
    paidRegistrationCount?: number;
    registrationRevenueRub?: number;
    unconfirmedAttendanceCount?: number;
    slots?: Pick<EventSlot, "id">[];
  },
): InstructorEventDTO {
  const isCompleted = isInstructorEventCompleted(row.eventAt);
  const slots = extra?.slots;
  return {
    id: row.id,
    title: row.title,
    titleId: row.titleId,
    catalogItemId: row.catalogItemId ?? null,
    body: row.body,
    category: row.category ?? null,
    photoUrl: row.photoUrl,
    eventAt: row.eventAt?.toISOString() ?? null,
    eventDay: row.eventAt ? eventDayFromIso(row.eventAt.toISOString()) : null,
    moderationStatus: row.moderationStatus,
    rejectNote: row.rejectNote,
    orderId: row.orderId,
    priceRub: row.priceRub,
    maxRegistrations: row.maxRegistrations,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    isCompleted,
    canEdit: canEditInstructorEvent(row),
    paidRegistrationCount: extra?.paidRegistrationCount,
    registrationRevenueRub: extra?.registrationRevenueRub,
    unconfirmedAttendanceCount: extra?.unconfirmedAttendanceCount,
    hasSlots: slots ? eventUsesSlots(slots) : undefined,
    repeatDaily: row.repeatDaily,
    venueAddress: row.venueAddress,
    venueLat: row.venueLat,
    venueLng: row.venueLng,
  };
}

export async function enrichClientEvent(
  row: InstructorEvent & { slots?: EventSlot[] },
  myRegistration: {
    id: string;
    status: EventRegistrationStatus;
    amountRub: import("@prisma/client").Prisma.Decimal | number;
    paidAt: Date | null;
    slotId?: string | null;
    adultCount?: number | null;
    childCount?: number | null;
  } | null,
  instructorName?: string | null,
  clientId?: string | null,
  instructorRatingAvg?: number | null,
): Promise<ClientInstructorEventDTO> {
  const slotRows =
    row.slots ??
    (await prisma.eventSlot.findMany({
      where: { eventId: row.id },
      orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
    }));

  const hasSlots = eventUsesSlots(slotRows);
  const slots = await loadEventSlotsForClient({ ...row, slots: slotRows }, clientId ?? null);
  const rating =
    instructorRatingAvg != null && Number.isFinite(instructorRatingAvg) ? instructorRatingAvg : null;

  if (hasSlots) {
    const openSlots = slots.filter((s) => s.registrationOpen);
    const base = serializeInstructorEvent(row, {
      paidRegistrationCount: slots.reduce((n, s) => n + s.paidCount, 0),
      slots: slotRows,
    });
    const mySlotReg = slots.find((s) => s.myRegistration)?.myRegistration ?? null;
    return {
      ...base,
      instructorId: row.instructorId,
      instructorName: instructorName ?? null,
      instructorRatingAvg: rating,
      slots,
      hasSlots: true,
      paidRegistrationCount: slots.reduce((n, s) => n + s.paidCount, 0),
      spotsLeft: openSlots.reduce((n, s) => n + (s.spotsLeft ?? 0), 0) || null,
      registrationOpen: openSlots.length > 0,
      isFree: slots.every((s) => s.isFree),
      myRegistration: mySlotReg,
      priceRub: slots[0]?.priceRub ?? row.priceRub,
    };
  }

  const { paidCount, spotsLeft, isFull } = await getEventCapacityState(row);
  const base = serializeInstructorEvent(row, { paidRegistrationCount: paidCount });
  return {
    ...base,
    instructorId: row.instructorId,
    instructorName: instructorName ?? null,
    instructorRatingAvg: rating,
    slots: [],
    hasSlots: false,
    paidRegistrationCount: paidCount,
    spotsLeft,
    registrationOpen: registrationOpenForEvent(row, isFull),
    isFree: isEventFree(row.priceRub),
    myRegistration: myRegistration
      ? serializeEventRegistration({
          ...myRegistration,
          eventAt: row.eventAt,
        })
      : null,
  };
}

export function formatEventDateRu(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatEventPriceRu(priceRub: number | null | undefined): string {
  if (priceRub == null || priceRub <= 0) return "Бесплатно";
  return `${priceRub.toLocaleString("ru-RU")} ₽`;
}

export function formatSlotTimeRu(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** Дата выхода без года (для строки записи): «23 июля». */
export function formatSlotDayRu(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Одна строка для клиента: «23 июля, 10:00 · Утренний · 5 000 ₽». */
export function formatSlotLineRu(
  startsAt: string | Date,
  opts?: { title?: string | null; priceRub?: number | null; includePrice?: boolean },
): string {
  const day = formatSlotDayRu(startsAt);
  const time = formatSlotTimeRu(startsAt);
  const parts = [`${day}, ${time}`];
  const title = opts?.title?.trim();
  if (title) parts.push(title);
  if (opts?.includePrice !== false) {
    parts.push(formatEventPriceRu(opts?.priceRub));
  }
  return parts.join(" · ");
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
