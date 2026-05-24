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
} from "@/lib/services/event-registration-cancel";
import { serializeEventRegistration } from "@/lib/services/event-registration";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id: eventId } = await ctx.params;

  const event = await prisma.instructorEvent.findFirst({
    where: { id: eventId, instructorId: userId },
    select: { id: true, title: true, eventAt: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.eventRegistration.findMany({
    where: { eventId, status: { in: ["PAID", "PENDING_PAYMENT"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      client: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const ratings = await getClientRatingsByInstructor(
    userId,
    rows.map((r) => r.clientId),
  );

  const paid = rows.filter((r) => r.status === "PAID");
  const revenueRub = paid.reduce((sum, r) => sum + Number(r.instructorShareAmount ?? 0), 0);

  const registrations: (InstructorRegistrationParticipant & {
    canCancel: boolean;
    cancelReason: string | null;
  })[] = rows.map((r) => {
    const rating = ratings.get(r.clientId);
    const quote = computeEventRegistrationCancelQuote({
      status: r.status,
      amountRub: r.amountRub,
      paidAt: r.paidAt,
      event: { eventAt: event.eventAt },
    });
    return {
      ...serializeEventRegistration(r),
      paidAt: r.paidAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
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
    };
  });

  return NextResponse.json({
    registrations,
    paidCount: paid.length,
    revenueRub,
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

  const registrationId =
    typeof json === "object" && json !== null && "registrationId" in json
      ? String((json as { registrationId: unknown }).registrationId)
      : "";
  const action =
    typeof json === "object" && json !== null && "action" in json
      ? String((json as { action: unknown }).action)
      : "";

  if (action !== "cancel_registration" || !registrationId) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const event = await prisma.instructorEvent.findFirst({
    where: { id: eventId, instructorId: userId },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await cancelEventRegistrationByInstructor({
      registrationId,
      instructorId: userId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось отменить";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
