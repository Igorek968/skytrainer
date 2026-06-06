import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { resolveUserRole } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validations/order";

type Ctx = { params: Promise<{ id: string }> };

async function assertOrderAccess(orderId: string, userId: string, role: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  const ok =
    order.clientId === userId ||
    (order.instructorId === userId && order.status !== "AWAITING_PAYMENT") ||
    role === "ADMIN";
  return ok ? order : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const role = (await resolveUserRole(session.user.id, session.user.role)) ?? session.user.role;
  const order = await assertOrderAccess(id, session.user.id, role);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, image: true } } },
    take: 500,
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const role = (await resolveUserRole(session.user.id, session.user.role)) ?? session.user.role;
  const order = await assertOrderAccess(id, session.user.id, role);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const msg = await prisma.message.create({
    data: {
      orderId: id,
      senderId: session.user.id,
      body: parsed.data.body,
    },
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json({ message: msg });
}
