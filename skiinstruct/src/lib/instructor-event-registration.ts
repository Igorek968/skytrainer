import type { EventRegistrationStatus } from "@prisma/client";

import { registrationStatusLabel } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

export type InstructorRegistrationParticipant = {
  id: string;
  status: EventRegistrationStatus;
  amountRub: number;
  paidAt: string | null;
  createdAt: string;
  client: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    /** Средняя оценка от этого инструктора по завершённым урокам */
    ratingAvg: number | null;
    ratingCount: number;
  };
};

export type InstructorRegistrationListItem = {
  id: string;
  status: EventRegistrationStatus;
  amountRub: number;
  paidAt: string | null;
  createdAt: string;
  client: InstructorRegistrationParticipant["client"];
  event: {
    id: string;
    title: string;
    eventAt: string | null;
    moderationStatus: string;
  };
};

export function instructorRegistrationStatusLabel(status: EventRegistrationStatus): string {
  return registrationStatusLabel(status);
}

/** Средняя оценка клиента по отзывам инструктора (instructorRating в заказах). */
export async function getClientRatingsByInstructor(
  instructorId: string,
  clientIds: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  if (!clientIds.length) return new Map();

  const orders = await prisma.order.findMany({
    where: {
      instructorId,
      clientId: { in: clientIds },
      status: "COMPLETED",
      instructorRating: { not: null },
    },
    select: { clientId: true, instructorRating: true },
  });

  const sums = new Map<string, { sum: number; count: number }>();
  for (const o of orders) {
    const r = o.instructorRating;
    if (r == null) continue;
    const prev = sums.get(o.clientId) ?? { sum: 0, count: 0 };
    prev.sum += r;
    prev.count += 1;
    sums.set(o.clientId, prev);
  }

  const out = new Map<string, { avg: number; count: number }>();
  for (const [clientId, { sum, count }] of sums) {
    out.set(clientId, { avg: sum / count, count });
  }
  return out;
}
