import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { isInstructorEventCompleted } from "@/lib/instructor-events";
import { EVENT_FORCE_MAJEURE_REASON_MAX } from "@/lib/legal-config";
import { prisma } from "@/lib/prisma";
import {
  cancelEventRegistrationByInstructor,
  canForceMajeureCancelEvent,
  forceMajeureCancelEvent,
} from "@/lib/services/event-registration-cancel";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("force_majeure"),
    reason: z.string().trim().min(3).max(EVENT_FORCE_MAJEURE_REASON_MAX),
  }),
]);

/** Скрыть событие / форс-мажор после начала с полным возвратом. */
export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id: eventId } = await ctx.params;

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    json = { action: "cancel" };
  }
  const parsed = bodySchema.safeParse(
    typeof json === "object" && json && "action" in json ? json : { action: "cancel" },
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const event = await prisma.instructorEvent.findFirst({
    where: { id: eventId, instructorId: userId },
    include: { slots: { select: { startsAt: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.action === "force_majeure") {
    try {
      const result = await forceMajeureCancelEvent({
        eventId,
        instructorId: userId,
        reason: parsed.data.reason,
      });
      return NextResponse.json({
        ok: true,
        forceMajeure: true,
        ...result,
        message: `Форс-мажор оформлен. Отменено записей: ${result.cancelledRegistrations}. Клиентам — полный возврат.`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось оформить форс-мажор";
      if (message === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (isInstructorEventCompleted(event.eventAt)) {
    return NextResponse.json({ error: "Событие уже прошло" }, { status: 400 });
  }

  const activeRegs = await prisma.eventRegistration.findMany({
    where: { eventId, status: { in: ["PAID", "PENDING_PAYMENT"] } },
    select: { id: true },
  });

  let cancelled = 0;
  for (const reg of activeRegs) {
    try {
      await cancelEventRegistrationByInstructor({
        registrationId: reg.id,
        instructorId: userId,
      });
      cancelled += 1;
    } catch {
      /* skip if cannot cancel */
    }
  }

  if (event.moderationStatus === "PUBLISHED" || event.moderationStatus === "ARCHIVED") {
    await prisma.instructorEvent.update({
      where: { id: eventId },
      data: { moderationStatus: "ARCHIVED" },
    });
  } else if (event.moderationStatus === "DRAFT" || event.moderationStatus === "REJECTED") {
    await prisma.instructorEvent.delete({ where: { id: eventId } });
    return NextResponse.json({
      ok: true,
      deleted: true,
      cancelledRegistrations: cancelled,
      message: "Черновик удалён, записи отменены",
    });
  }

  return NextResponse.json({
    ok: true,
    archived: true,
    cancelledRegistrations: cancelled,
    message: `Событие скрыто. Отменено записей: ${cancelled}`,
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;
  const { id: eventId } = await ctx.params;

  const event = await prisma.instructorEvent.findFirst({
    where: { id: eventId, instructorId: userId },
    include: { slots: { select: { startsAt: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    canForceMajeure: canForceMajeureCancelEvent({
      forceMajeureAt: event.forceMajeureAt,
      eventAt: event.eventAt,
      slotStarts: event.slots.map((s) => s.startsAt),
    }),
    forceMajeureAt: event.forceMajeureAt?.toISOString() ?? null,
    forceMajeureReason: event.forceMajeureReason,
    reasonMax: EVENT_FORCE_MAJEURE_REASON_MAX,
  });
}
