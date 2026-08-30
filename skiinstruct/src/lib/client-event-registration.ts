import type { EventRegistrationStatus } from "@prisma/client";

import { formatEventDateRu, registrationStatusLabel } from "@/lib/instructor-events";

export type ClientRegistrationListItem = {
  id: string;
  status: EventRegistrationStatus;
  amountRub: number;
  paidAt: string | null;
  attendanceConfirmedAt: string | null;
  needsAttendanceConfirmation: boolean;
  eventCompleted: boolean;
  /** Фактическое начало: слот или eventAt. */
  startsAt: string | null;
  createdAt: string;
  event: {
    id: string;
    title: string;
    eventAt: string | null;
    priceRub: number | null;
  };
  instructor: {
    id: string;
    name: string | null;
  };
};

export type ClientRegistrationDetail = ClientRegistrationListItem & {
  event: ClientRegistrationListItem["event"] & {
    body: string;
    venueAddress: string | null;
    venueLat: number | null;
    venueLng: number | null;
  };
  canCancel: boolean;
  cancelReason: string | null;
  instructorNoShowRefundEligible?: boolean;
  clientRating: number | null;
  clientReview: string | null;
  canLeaveReview: boolean;
  adultCount: number;
  childCount: number;
};

export function clientRegistrationStatusLabel(
  status: EventRegistrationStatus,
  opts?: { amountRub?: number },
): string {
  if (status === "PAID" && (opts?.amountRub == null || opts.amountRub <= 0)) {
    return "Записан";
  }
  return registrationStatusLabel(status);
}

export function clientRegistrationListTitle(item: ClientRegistrationListItem): string {
  const when = formatEventDateRu(item.event.eventAt);
  const instructor = item.instructor.name?.trim() || "Инструктор";
  return `${item.event.title}${when ? ` · ${when}` : ""} · ${instructor}`;
}
