import type { EventRegistration, EventSlot, InstructorEvent } from "@prisma/client";

import { isInstructorEventCompleted } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { getEventRegistrationStartAt } from "@/lib/services/event-registration-cancel";

type RegTiming = {
  status: EventRegistration["status"];
  clientRating?: number | null;
  instructorRating?: number | null;
  attendanceConfirmedAt?: Date | null;
  event: Pick<InstructorEvent, "eventAt">;
  slot?: Pick<EventSlot, "startsAt"> | null;
};

/** Клиент может оценить инструктора после окончания оплаченного события. */
export function canClientReviewEventRegistration(reg: RegTiming): boolean {
  if (reg.status !== "PAID") return false;
  if (reg.clientRating != null) return false;
  const startAt = getEventRegistrationStartAt(reg);
  return isInstructorEventCompleted(startAt);
}

/** Инструктор может оценить участника, который подтвердил присутствие. */
export function canInstructorReviewEventRegistration(reg: RegTiming): boolean {
  if (reg.status !== "PAID") return false;
  if (!reg.attendanceConfirmedAt) return false;
  if (reg.instructorRating != null) return false;
  const startAt = getEventRegistrationStartAt(reg);
  return isInstructorEventCompleted(startAt);
}

export async function addEventRegistrationClientReview(params: {
  registrationId: string;
  clientId: string;
  rating: number;
  review?: string | null;
}) {
  const rating = Math.round(params.rating);
  if (rating < 1 || rating > 5) throw new Error("Оценка от 1 до 5");
  const reviewText = params.review?.trim() ? params.review.trim().slice(0, 2000) : null;

  const reg = await prisma.eventRegistration.findFirst({
    where: { id: params.registrationId, clientId: params.clientId },
    include: {
      event: { select: { eventAt: true, instructorId: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!reg) throw new Error("NOT_FOUND");
  if (!canClientReviewEventRegistration(reg)) {
    throw new Error(
      reg.clientRating != null
        ? "Оценка уже оставлена"
        : "Отзыв доступен после окончания оплаченного события",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.eventRegistration.update({
      where: { id: reg.id },
      data: { clientRating: rating, clientReview: reviewText },
    });

    const profile = await tx.instructorProfile.findUnique({
      where: { userId: reg.event.instructorId },
    });
    if (profile) {
      const n = profile.reviewCount + 1;
      const avg = (profile.ratingAvg * profile.reviewCount + rating) / n;
      await tx.instructorProfile.update({
        where: { userId: reg.event.instructorId },
        data: { ratingAvg: avg, reviewCount: n },
      });
    }

    return updated;
  });
}

export async function addEventRegistrationInstructorReview(params: {
  registrationId: string;
  instructorId: string;
  rating: number;
  review?: string | null;
}) {
  const rating = Math.round(params.rating);
  if (rating < 1 || rating > 5) throw new Error("Оценка от 1 до 5");
  const reviewText = params.review?.trim() ? params.review.trim().slice(0, 2000) : null;

  const reg = await prisma.eventRegistration.findFirst({
    where: { id: params.registrationId, event: { instructorId: params.instructorId } },
    include: {
      event: { select: { eventAt: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!reg) throw new Error("NOT_FOUND");
  if (!canInstructorReviewEventRegistration(reg)) {
    throw new Error(
      reg.instructorRating != null
        ? "Оценка клиенту уже оставлена"
        : "Оценить можно участников, которые подтвердили присутствие после события",
    );
  }

  return prisma.eventRegistration.update({
    where: { id: reg.id },
    data: { instructorRating: rating, instructorReview: reviewText },
  });
}
