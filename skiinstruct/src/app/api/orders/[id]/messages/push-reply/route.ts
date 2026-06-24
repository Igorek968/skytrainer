import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { verifyChatPushReplyToken } from "@/lib/chat-push-reply-token";
import { prisma } from "@/lib/prisma";
import { notifyInstructorClientChatMessage } from "@/lib/services/instructor-chat-notify";
import { messageSchema } from "@/lib/validations/order";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  body: messageSchema.shape.body,
  token: z.string().min(8).optional(),
});

/** Быстрый ответ в чат из push (service worker / без полной сессии в фоне). */
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

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      clientId: true,
      instructorId: true,
      client: { select: { name: true } },
    },
  });
  if (!order?.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { body, token } = parsed.data;
  let senderId: string | null = null;

  if (token) {
    if (!verifyChatPushReplyToken(token, orderId, order.clientId)) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
    }
    senderId = order.clientId;
  } else {
    const session = await auth();
    if (!session?.user?.id || session.user.id !== order.clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    senderId = session.user.id;
  }

  const msg = await prisma.message.create({
    data: {
      orderId,
      senderId,
      body,
    },
    include: {
      sender: { select: { id: true, name: true } },
    },
  });

  if (order.instructorId) {
    void notifyInstructorClientChatMessage({
      orderId,
      messageId: msg.id,
      instructorId: order.instructorId,
      clientName: order.client?.name ?? msg.sender.name,
      body: msg.body,
    });
  }

  return NextResponse.json({ ok: true, message: msg });
}
