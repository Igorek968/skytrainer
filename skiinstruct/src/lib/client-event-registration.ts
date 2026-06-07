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
  };
  canCancel: boolean;
  cancelReason: string | null;
  instructorNoShowRefundEligible?: boolean;
};

export function clientRegistrationStatusLabel(status: EventRegistrationStatus): string {
  return registrationStatusLabel(status);
}

export function clientRegistrationListTitle(item: ClientRegistrationListItem): string {
  const when = formatEventDateRu(item.event.eventAt);
  const instructor = item.instructor.name?.trim() || "Инструктор";
  return `${item.event.title}${when ? ` · ${when}` : ""} · ${instructor}`;
}
