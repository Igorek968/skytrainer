import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  getClientRatingsByInstructor,
  type InstructorRegistrationParticipant,
} from "@/lib/instructor-event-registration";
import { prisma } from "@/lib/prisma";
import {
  computeEventRegistrationCancelQuote,
  cancelEventRegistrationByInstructor,
  canForceMajeureCancelEvent,
} from "@/lib/services/event-registration-cancel";
import {
  addEventRegistrationInstructorReview,
  canInstructorReviewEventRegistration,
} from "@/lib/services/event-registration-review";
import { attendanceStatusLabel } from "@/lib/services/event-attendance-shared";
import { formatSlotTimeRu } from "@/lib/instructor-events";
import { serializeEventRegistration } from "@/lib/services/event-registration";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id: eventId } = await ctx.params;

  const event = await prisma.instructorEvent.findFirst({
    where: { id: eventId, instructorId: userId },
    select: {
      id: true,
      title: true,
      eventAt: true,
      forceMajeureAt: true,
      forceMajeureReason: true,
      slots: { select: { startsAt: true } },
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.eventRegistration.findMany({
    where: { eventId, status: "PAID" },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      client: { select: { id: true, name: true, email: true, image: true } },
      slot: { select: { id: true, startsAt: true, maxSeats: true } },
    },
  });

  const ratings = await getClientRatingsByInstructor(
    userId,
    rows.map((r) => r.clientId),
  );

  const paid = rows.filter((r) => r.status === "PAID" && r.attendanceConfirmedAt);
  const revenueRub = paid.reduce((sum, r) => sum + Number(r.instructorShareAmount ?? 0), 0);

  const registrations: (InstructorRegistrationParticipant & {
    canCancel: boolean;
    cancelReason: string | null;
    attendanceLabel: string;
    attendanceConfirmedAt: string | null;
    slotId: string | null;
    slotTime: string | null;
    instructorRating: number | null;
    canReviewAttendee: boolean;
  })[] = rows.map((r) => {
    const rating = ratings.get(r.clientId);
    const effectiveAt = r.slot?.startsAt ?? event.eventAt;
    const quote = computeEventRegistrationCancelQuote({
      status: r.status,
      amountRub: r.amountRub,
      paidAt: r.paidAt,
      event: { eventAt: effectiveAt },
    });
    return {
      ...serializeEventRegistration({
        id: r.id,
        status: r.status,
        amountRub: r.amountRub,
        paidAt: r.paidAt,
        attendanceConfirmedAt: r.attendanceConfirmedAt,
        eventAt: effectiveAt,
        adultCount: r.adultCount,
        childCount: r.childCount,
      }),
      paidAt: r.paidAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      attendanceConfirmedAt: r.attendanceConfirmedAt?.toISOString() ?? null,
      attendanceLabel: attendanceStatusLabel(r, effectiveAt),
      slotId: r.slotId,
      slotTime: r.slot?.startsAt ? formatSlotTimeRu(r.slot.startsAt) : null,
      client: {
        id: r.client.id,
        name: r.client.name,
        email: r.client.email,
        image: r.client.image,
        ratingAvg: rating?.avg ?? null,
        ratingCount: rating?.count ?? 0,
      },
      canCancel: quote.canCancel,
      cancelReason: quote.canCancel ? null : quote.reason,
      instructorRating: r.instructorRating,
      canReviewAttendee: canInstructorReviewEventRegistration({
        status: r.status,
        instructorRating: r.instructorRating,
        attendanceConfirmedAt: r.attendanceConfirmedAt,
        event: { eventAt: event.eventAt },
        slot: r.slot ? { startsAt: r.slot.startsAt } : null,
      }),
    };
  });

  return NextResponse.json({
    registrations,
    paidCount: paid.length,
    revenueRub,
    canForceMajeure: canForceMajeureCancelEvent({
      forceMajeureAt: event.forceMajeureAt,
      eventAt: event.eventAt,
      slotStarts: event.slots.map((s) => s.startsAt),
    }),
    forceMajeureReason: event.forceMajeureReason,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id: eventId } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patchSchema = z.discriminatedUnion("action", [
    z.object({
      action: z.literal("cancel_registration"),
      registrationId: z.string().min(1),
    }),
    z.object({
      action: z.literal("add_client_review"),
      registrationId: z.string().min(1),
      rating: z.number().int().min(1).max(5),
      review: z.string().max(2000).optional(),
    }),
  ]);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const event = await prisma.instructorEvent.findFirst({
    where: { id: eventId, instructorId: userId },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.action === "add_client_review") {
    try {
      await addEventRegistrationInstructorReview({
        registrationId: parsed.data.registrationId,
        instructorId: userId,
        rating: parsed.data.rating,
        review: parsed.data.review,
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось сохранить отзыв";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  try {
    const result = await cancelEventRegistrationByInstructor({
      registrationId: parsed.data.registrationId,
      instructorId: userId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось отменить";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
