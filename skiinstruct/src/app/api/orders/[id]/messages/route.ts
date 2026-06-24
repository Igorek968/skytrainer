import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { resolveUserRole } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { notifyInstructorClientChatMessage } from "@/lib/services/instructor-chat-notify";
import { notifyClientInstructorChatMessage } from "@/lib/services/client-chat-notify";
import { messageSchema } from "@/lib/validations/order";

type Ctx = { params: Promise<{ id: string }> };

async function assertOrderAccess(orderId: string, userId: string, role: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  const ok =
    order.clientId === userId || order.instructorId === userId || role === "ADMIN";
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
    include: {
      sender: { select: { id: true, name: true, image: true } },
      order: {
        select: {
          instructorId: true,
          clientId: true,
          client: { select: { name: true } },
          instructor: { select: { name: true } },
        },
      },
    },
  });

  if (msg.order.instructorId && msg.senderId === msg.order.clientId) {
    void notifyInstructorClientChatMessage({
      orderId: id,
      messageId: msg.id,
      instructorId: msg.order.instructorId,
      clientName: msg.order.client?.name ?? msg.sender.name,
      body: msg.body,
    });
  }

  if (msg.order.clientId && msg.order.instructorId && msg.senderId === msg.order.instructorId) {
    void notifyClientInstructorChatMessage({
      orderId: id,
      messageId: msg.id,
      clientId: msg.order.clientId,
      instructorName: msg.order.instructor?.name ?? msg.sender.name,
      body: msg.body,
    });
  }

  const { order: _order, ...message } = msg;
  return NextResponse.json({ message });
}
