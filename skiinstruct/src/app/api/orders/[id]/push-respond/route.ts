import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { verifyOrderPushActionToken } from "@/lib/order-push-action-token";
import { prisma } from "@/lib/prisma";
import { instructorRespondToPendingOrder } from "@/lib/services/instructor-pending-order-respond";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["accept", "reject"]),
  token: z.string().min(8).optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const { id: orderId } = await ctx.params;

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

  const { action, token } = parsed.data;
  let instructorUserId: string | null = null;

  if (token) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { instructorId: true },
    });
    if (!order?.instructorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!verifyOrderPushActionToken(token, orderId, order.instructorId)) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
    }
    instructorUserId = order.instructorId;
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    instructorUserId = session.user.id;
  }

  const result = await instructorRespondToPendingOrder(orderId, instructorUserId, action);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, order: result.order });
}
