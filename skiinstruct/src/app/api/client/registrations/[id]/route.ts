import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import type { ClientRegistrationDetail } from "@/lib/client-event-registration";
import {
  confirmEventAttendance,
  registrationNeedsAttendanceConfirmation,
} from "@/lib/services/event-attendance";
import {
  cancelEventRegistration,
  canClaimEventInstructorNoShowRefund,
  claimEventInstructorNoShowRefund,
  computeEventRegistrationCancelQuote,
  getEventRegistrationStartAt,
} from "@/lib/services/event-registration-cancel";
import { createEventCheckoutUrl } from "@/lib/services/event-checkout";
import { isInstructorEventCompleted } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["preview_cancel", "cancel", "pay", "confirm_attendance", "claim_instructor_no_show_refund"]),
});

function buildRegistrationDetail(
  row: Awaited<ReturnType<typeof loadRegistration>>,
): ClientRegistrationDetail {
  if (!row) throw new Error("missing row");
  const quote = computeEventRegistrationCancelQuote({
    status: row.status,
    amountRub: row.amountRub,
    paidAt: row.paidAt,
    instructorNoShowRefundClaimedAt: row.instructorNoShowRefundClaimedAt,
    event: { eventAt: row.event.eventAt },
    slot: row.slot ? { startsAt: row.slot.startsAt } : null,
  });
  const eventCompleted = isInstructorEventCompleted(
    getEventRegistrationStartAt({
      event: { eventAt: row.event.eventAt },
      slot: row.slot ? { startsAt: row.slot.startsAt } : null,
    }),
  );
  const instructorNoShowRefundEligible = canClaimEventInstructorNoShowRefund({
    status: row.status,
    amountRub: row.amountRub,
    paidAt: row.paidAt,
    instructorNoShowRefundClaimedAt: row.instructorNoShowRefundClaimedAt,
    event: { eventAt: row.event.eventAt },
    slot: row.slot ? { startsAt: row.slot.startsAt } : null,
  });
  const needsAttendanceConfirmation = registrationNeedsAttendanceConfirmation(
    row,
    getEventRegistrationStartAt({
      event: { eventAt: row.event.eventAt },
      slot: row.slot ? { startsAt: row.slot.startsAt } : null,
    }),
  );

  return {
    id: row.id,
    status: row.status,
    amountRub: Number(row.amountRub),
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    attendanceConfirmedAt: row.attendanceConfirmedAt?.toISOString() ?? null,
    needsAttendanceConfirmation,
    eventCompleted,
    event: {
      id: row.event.id,
      title: row.event.title,
      body: row.event.body,
      eventAt: row.event.eventAt?.toISOString() ?? null,
      priceRub: row.event.priceRub,
    },
    instructor: {
      id: row.event.instructor.id,
      name: row.event.instructor.name,
    },
    canCancel: quote.canCancel,
    cancelReason: quote.canCancel ? null : quote.reason,
    instructorNoShowRefundEligible,
  };
}

async function loadRegistration(id: string, clientId: string) {
  return prisma.eventRegistration.findFirst({
    where: { id, clientId },
    include: {
      slot: { select: { startsAt: true } },
      event: {
        select: {
          id: true,
          title: true,
          body: true,
          eventAt: true,
          priceRub: true,
          instructor: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const { id } = await ctx.params;
  const row = await loadRegistration(id, resolved.userId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ registration: buildRegistrationDetail(row) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = await loadRegistration(id, resolved.userId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.action === "confirm_attendance") {
    try {
      const result = await confirmEventAttendance({
        registrationId: id,
        clientId: resolved.userId,
      });
      const updated = await loadRegistration(id, resolved.userId);
      return NextResponse.json({
        ...result,
        registration: updated ? buildRegistrationDetail(updated) : null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось подтвердить участие";
      if (msg === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (parsed.data.action === "pay") {
    if (row.status !== "PENDING_PAYMENT" || row.paidAt) {
      return NextResponse.json({ error: "Оплата не требуется" }, { status: 400 });
    }
    if (!isInstructorEventCompleted(row.event.eventAt)) {
      return NextResponse.json(
        { error: "Оплата будет доступна после окончания события. Сначала дождитесь даты события." },
        { status: 400 },
      );
    }
    try {
      const checkoutUrl = await createEventCheckoutUrl(id, resolved.session.user.email);
      return NextResponse.json({ checkoutUrl });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось создать оплату";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (parsed.data.action === "claim_instructor_no_show_refund") {
    try {
      const result = await claimEventInstructorNoShowRefund({
        registrationId: id,
        clientId: resolved.userId,
      });
      const updated = await loadRegistration(id, resolved.userId);
      return NextResponse.json({
        ok: true,
        refundPercent: result.refundPercent,
        refundAmount: result.refundAmount,
        reason: result.reason,
        registration: updated ? buildRegistrationDetail(updated) : null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось оформить возврат";
      if (msg === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const quote = computeEventRegistrationCancelQuote({
    status: row.status,
    amountRub: row.amountRub,
    paidAt: row.paidAt,
    instructorNoShowRefundClaimedAt: row.instructorNoShowRefundClaimedAt,
    event: { eventAt: row.event.eventAt },
    slot: row.slot ? { startsAt: row.slot.startsAt } : null,
  });

  if (parsed.data.action === "preview_cancel") {
    if (!quote.canCancel) {
      return NextResponse.json({ error: quote.reason }, { status: 400 });
    }
    return NextResponse.json({
      refundPercent: quote.refundPercent,
      refundAmount: quote.refundAmount,
      reason: quote.reason,
    });
  }

  try {
    const result = await cancelEventRegistration({
      registrationId: id,
      clientId: resolved.userId,
    });
    return NextResponse.json({
      ok: true,
      refundPercent: result.refundPercent,
      refundAmount: result.refundAmount,
      reason: result.reason,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось отменить";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
