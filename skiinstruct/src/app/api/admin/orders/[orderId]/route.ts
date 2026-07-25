import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { mapOrderOverviewRow } from "@/lib/admin-order-overview";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/services/admin-audit";
import { notifyInstructorOfPendingOrder } from "@/lib/services/instructor-order-notify";
import { cancelOrderWithRefund, retryFailedOrderRefund } from "@/lib/services/order-refund";
import { computePendingExpiresAt } from "@/shared/lib/order-flex";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orderId: string }> };

const patchSchema = z.object({
  action: z.enum(["cancel_refund", "retry_refund", "reassign_instructor"]),
  instructorId: z.string().cuid().optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { orderId } = await ctx.params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      instructor: { select: { id: true, name: true, email: true, phone: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true,
          body: true,
          createdAt: true,
          sender: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const overview = mapOrderOverviewRow({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    flexibleInstructorInvite: order.flexibleInstructorInvite,
    urgentInvite: order.urgentInvite,
    pendingExpiresAt: order.pendingExpiresAt,
    amountTotal: order.amountTotal,
    paymentStatus: order.paymentStatus,
    client: order.client,
    instructor: order.instructor,
  });

  return NextResponse.json({
    order: {
      ...overview,
      clientId: order.clientId,
      instructorId: order.instructorId,
      client: order.client,
      instructor: order.instructor,
      notes: order.notes,
      refundPercent: order.refundPercent,
      refundAmount: order.refundAmount != null ? Number(order.refundAmount) : null,
      refundStatus: order.refundStatus,
      refundNote: order.refundNote,
      cancelledBy: order.cancelledBy,
      qualityClaimCategory: order.qualityClaimCategory,
      qualityClaimDescription: order.qualityClaimDescription,
      qualityClaimedAt: order.qualityClaimedAt?.toISOString() ?? null,
      instructorQueue: Array.isArray(order.instructorQueue) ? order.instructorQueue : [],
      pendingExpiresAt: order.pendingExpiresAt?.toISOString() ?? null,
      acceptedAt: order.acceptedAt?.toISOString() ?? null,
      lessonStartedAt: order.lessonStartedAt?.toISOString() ?? null,
      lessonEndedAt: order.lessonEndedAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      messages: order.messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        sender: m.sender,
      })),
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { orderId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  try {
    if (parsed.data.action === "cancel_refund") {
      const result = await cancelOrderWithRefund({
        orderId,
        actorUserId: auth.userId,
        cancelledBy: "PLATFORM",
      });
      await writeAdminAudit({
        actorId: auth.userId,
        action: "order.cancel_refund",
        entity: "Order",
        entityId: orderId,
        summary: `Отмена заказа со возвратом ${result.refundAmount} ₽ (${result.refundPercent}%)`,
      });
      return NextResponse.json({
        ok: true,
        message: `Заказ отменён. Возврат: ${result.refundAmount} ₽ (${result.refundPercent}%).`,
        refundAmount: result.refundAmount,
        refundPercent: result.refundPercent,
      });
    }

    if (parsed.data.action === "retry_refund") {
      const result = await retryFailedOrderRefund({ orderId });
      await writeAdminAudit({
        actorId: auth.userId,
        action: "order.retry_refund",
        entity: "Order",
        entityId: orderId,
        summary: `Повтор возврата: ${result.refundStatus}`,
      });
      return NextResponse.json({
        ok: true,
        message: "Повтор возврата выполнен",
        refundStatus: result.refundStatus,
      });
    }

    const instructorId = parsed.data.instructorId?.trim();
    if (!instructorId) {
      return NextResponse.json({ error: "Укажите instructorId" }, { status: 400 });
    }

    const instr = await prisma.user.findFirst({
      where: {
        id: instructorId,
        role: "INSTRUCTOR",
        suspendedAt: null,
        instructorProfile: { verificationStatus: "APPROVED" },
      },
      select: { id: true, name: true, email: true },
    });
    if (!instr) {
      return NextResponse.json(
        { error: "Инструктор не найден, не одобрен или заблокирован" },
        { status: 400 },
      );
    }

    const activeStatuses = [
      "PENDING_INSTRUCTOR",
      "ACCEPTED",
      "INSTRUCTOR_EN_ROUTE",
      "LESSON_STARTED",
    ] as const;
    if (!activeStatuses.includes(existing.status as (typeof activeStatuses)[number])) {
      return NextResponse.json(
        { error: "Переназначение доступно только для активных заказов" },
        { status: 400 },
      );
    }

    const queue = Array.isArray(existing.instructorQueue)
      ? (existing.instructorQueue as string[]).filter((id) => id !== instructorId)
      : [];
    queue.unshift(instructorId);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        instructorId,
        instructorQueue: queue,
        status: "PENDING_INSTRUCTOR",
        pendingExpiresAt: computePendingExpiresAt({
          flexibleInstructorInvite: existing.flexibleInstructorInvite,
          urgentInvite: existing.urgentInvite,
          requestedDays: existing.requestedDays,
          requestedStartDate: existing.requestedStartDate,
        }),
        acceptedAt: null,
        lessonStartedAt: null,
      },
    });

    try {
      await notifyInstructorOfPendingOrder(orderId);
    } catch (e) {
      console.error("[admin-order] notify reassign", e instanceof Error ? e.message : e);
    }

    await writeAdminAudit({
      actorId: auth.userId,
      action: "order.reassign",
      entity: "Order",
      entityId: orderId,
      summary: `Переназначен инструктор ${instr.name ?? instr.email}`,
      meta: { instructorId },
    });

    return NextResponse.json({
      ok: true,
      message: `Заказ переназначен на ${instr.name ?? instr.email}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка действия" },
      { status: 400 },
    );
  }
}
