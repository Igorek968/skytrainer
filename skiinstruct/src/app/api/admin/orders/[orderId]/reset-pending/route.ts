import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { mapOrderOverviewRow, orderOverviewSelect } from "@/lib/admin-order-overview";
import { prisma } from "@/lib/prisma";
import { assignInstructorByQueue } from "@/lib/services/instructor-routing";
import { applyRefundForExpiredOrder } from "@/lib/services/order-refund";
import { orderStatusLabel } from "@/shared/lib/order-status";

type Ctx = { params: Promise<{ orderId: string }> };

const bodySchema = z.object({
  action: z.enum(["next_instructor", "cancel_waiting"]),
});

/**
 * Действия админа для заказа PENDING_INSTRUCTOR:
 * - next_instructor — закрыть ожидание (EXPIRED, возврат при оплате; другим не передаётся)
 * - cancel_waiting — снять ожидание (EXPIRED)
 */
export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { orderId } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  if (order.status !== "PENDING_INSTRUCTOR") {
    return NextResponse.json(
      {
        error: `Действие доступно только для «${orderStatusLabel("PENDING_INSTRUCTOR")}» (сейчас: ${orderStatusLabel(order.status)}).`,
      },
      { status: 400 },
    );
  }

  if (parsed.data.action === "cancel_waiting") {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "EXPIRED",
        pendingExpiresAt: null,
      },
    });
    await applyRefundForExpiredOrder(orderId);
  } else {
    await assignInstructorByQueue(orderId, "timeout");
  }

  const updated = await prisma.order.findUnique({
    where: { id: orderId },
    select: orderOverviewSelect,
  });

  if (!updated) {
    return NextResponse.json({ error: "Заказ не найден после действия" }, { status: 500 });
  }

  const message =
    parsed.data.action === "cancel_waiting"
      ? "Ожидание снято — заказ закрыт как «Не удалось назначить инструктора»."
      : "Ожидание снято — заказ закрыт как «Не удалось назначить инструктора».";

  return NextResponse.json({
    ok: true,
    action: parsed.data.action,
    order: mapOrderOverviewRow(updated),
    message,
  });
}
