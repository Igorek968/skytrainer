import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/services/admin-audit";
import { retryFailedOrderRefund } from "@/lib/services/order-refund";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orderId: string }> };

const bodySchema = z.object({
  action: z.enum(["retry_refund", "resolve"]),
  note: z.string().trim().max(2000).optional(),
});

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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, qualityClaimedAt: true, refundStatus: true, refundNote: true },
  });
  if (!order || !order.qualityClaimedAt) {
    return NextResponse.json({ error: "Претензия не найдена" }, { status: 404 });
  }

  if (parsed.data.action === "retry_refund") {
    try {
      const result = await retryFailedOrderRefund({ orderId });
      await writeAdminAudit({
        actorId: auth.userId,
        action: "quality_claim.retry_refund",
        entity: "Order",
        entityId: orderId,
        summary: `Повтор возврата по претензии: ${result.refundStatus}`,
      });
      return NextResponse.json({ ok: true, refundStatus: result.refundStatus, message: "Возврат повторён" });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Ошибка возврата" },
        { status: 400 },
      );
    }
  }

  const note = parsed.data.note?.trim() || "Закрыто администратором";
  const prev = order.refundNote?.trim();
  const refundNote = prev ? `${prev}\n[Админ] ${note}` : `[Админ] ${note}`;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      refundNote,
      ...(order.refundStatus === "FAILED" ? {} : {}),
    },
  });

  await writeAdminAudit({
    actorId: auth.userId,
    action: "quality_claim.resolve",
    entity: "Order",
    entityId: orderId,
    summary: note,
  });

  return NextResponse.json({ ok: true, message: "Претензия отмечена как рассмотренная" });
}
