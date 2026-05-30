import type {
  EventRegistrationStatus,
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

export type InstructorEventDTO = {
  id: string;
  title: string;
  titleId: string | null;
  body: string;
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
  /** По дате/времени мероприятия */
  isCompleted: boolean;
  canEdit: boolean;
  /** Только для инструктора */
  paidRegistrationCount?: number;
  registrationRevenueRub?: number;
  unconfirmedAttendanceCount?: number;
};

export type ClientInstructorEventDTO = InstructorEventDTO & {
  instructorName?: string | null;
  /** Расстояние от точки клиента на карте до инструктора, км */
  distanceKm?: number;
  paidRegistrationCount: number;
  spotsLeft: number | null;
  registrationOpen: boolean;
  isFree: boolean;
  myRegistration: EventRegistrationSummary | null;
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

/** Скрытое мероприятие можно вернуть в черновик (редактировать / отправить на модерацию). */
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
  return (ev.canEdit || canRestoreArchivedEvent(ev)) && Boolean(ev.eventAt);
}

export function showEventCardDelete(ev: InstructorEventDTO): boolean {
  if (ev.moderationStatus === "PUBLISHED") return true;
  if (ev.canEdit) return true;
  if (canRestoreArchivedEvent(ev)) return true;
  if (ev.moderationStatus === "ARCHIVED" && ev.isCompleted) return true;
  return false;
}

export function eventCardDeleteLabel(ev: InstructorEventDTO): string {
  if (ev.moderationStatus === "PUBLISHED") return "Скрыть из ленты";
  if (ev.moderationStatus === "ARCHIVED" && ev.isCompleted) return "Удалить";
  return "Удалить";
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
      return "Записан";
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
  },
): InstructorEventDTO {
  const isCompleted = isInstructorEventCompleted(row.eventAt);
  return {
    id: row.id,
    title: row.title,
    titleId: row.titleId,
    body: row.body,
    photoUrl: row.photoUrl,
    eventAt: row.eventAt?.toISOString() ?? null,
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
  };
}

export async function enrichClientEvent(
  row: InstructorEvent,
  myRegistration: {
    id: string;
    status: EventRegistrationStatus;
    amountRub: import("@prisma/client").Prisma.Decimal | number;
    paidAt: Date | null;
  } | null,
  instructorName?: string | null,
): Promise<ClientInstructorEventDTO> {
  const { paidCount, spotsLeft, isFull } = await getEventCapacityState(row);
  const base = serializeInstructorEvent(row, { paidRegistrationCount: paidCount });
  return {
    ...base,
    instructorName: instructorName ?? null,
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

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
