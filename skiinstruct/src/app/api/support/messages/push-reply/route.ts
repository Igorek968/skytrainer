import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { appendUserSupportMessage } from "@/lib/support-service";
import { verifySupportPushReplyToken } from "@/lib/support-push-token";
import { messageSchema } from "@/lib/validations/order";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  body: messageSchema.shape.body,
  ticketId: z.string().min(1),
  token: z.string().min(8).optional(),
});

/** Быстрый ответ в поддержку из push (service worker). */
export async function POST(req: Request) {
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

  const { body, ticketId, token } = parsed.data;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!ticket || ticket.status !== "OPEN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!ticket.userId || !ticket.user) {
    return NextResponse.json({ error: "Ticket has no user" }, { status: 400 });
  }

  let senderId: string | null = null;
  if (token) {
    if (!verifySupportPushReplyToken(token, ticketId, ticket.userId)) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
    }
    senderId = ticket.userId;
  } else {
    const session = await auth();
    if (!session?.user?.id || session.user.id !== ticket.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    senderId = session.user.id;
  }

  const msg = await appendUserSupportMessage(ticket.id, body, {
    userId: senderId,
    guestEmail: ticket.user.email,
    guestName: null,
    userName: ticket.user.name,
  });

  return NextResponse.json({
    ok: true,
    message: {
      id: msg.id,
      authorRole: msg.authorRole,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    },
  });
}
