import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import type { ClientRegistrationDetail } from "@/lib/client-event-registration";
import {
  cancelEventRegistration,
  computeEventRegistrationCancelQuote,
} from "@/lib/services/event-registration-cancel";
import { createEventCheckoutUrl } from "@/lib/services/event-checkout";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["preview_cancel", "cancel", "pay"]),
});

export async function GET(_req: Request, ctx: Ctx) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const { id } = await ctx.params;

  const row = await prisma.eventRegistration.findFirst({
    where: { id, clientId: resolved.userId },
    include: {
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

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quote = computeEventRegistrationCancelQuote({
    status: row.status,
    amountRub: row.amountRub,
    paidAt: row.paidAt,
    event: { eventAt: row.event.eventAt },
  });

  const registration: ClientRegistrationDetail = {
    id: row.id,
    status: row.status,
    amountRub: Number(row.amountRub),
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
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
  };

  return NextResponse.json({ registration });
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

  const row = await prisma.eventRegistration.findFirst({
    where: { id, clientId: resolved.userId },
    include: { event: { select: { eventAt: true } } },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.action === "pay") {
    if (row.status !== "PENDING_PAYMENT") {
      return NextResponse.json({ error: "Оплата не требуется" }, { status: 400 });
    }
    try {
      const checkoutUrl = await createEventCheckoutUrl(id);
      return NextResponse.json({ checkoutUrl });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось создать оплату";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const quote = computeEventRegistrationCancelQuote({
    status: row.status,
    amountRub: row.amountRub,
    paidAt: row.paidAt,
    event: { eventAt: row.event.eventAt },
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
