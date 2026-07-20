import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { resolveUserRole } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { assertRegistrationChatAccess } from "@/lib/services/registration-chat";
import { notifyRegistrationChatMessage } from "@/lib/services/registration-chat-notify";
import { messageSchema } from "@/lib/validations/order";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const role = (await resolveUserRole(session.user.id, session.user.role)) ?? session.user.role;
  const access = await assertRegistrationChatAccess({
    registrationId: id,
    userId: session.user.id,
    role,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const messages = await prisma.eventRegistrationMessage.findMany({
    where: { registrationId: id },
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
  const access = await assertRegistrationChatAccess({
    registrationId: id,
    userId: session.user.id,
    role,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
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

  const msg = await prisma.eventRegistrationMessage.create({
    data: {
      registrationId: id,
      senderId: session.user.id,
      body: parsed.data.body,
    },
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  const clientId = access.reg.clientId;
  const instructorId = access.reg.event.instructorId;
  if (clientId && instructorId) {
    if (msg.senderId === clientId) {
      void notifyRegistrationChatMessage({
        registrationId: id,
        messageId: msg.id,
        recipientId: instructorId,
        recipientRole: "instructor",
        senderName: access.reg.client?.name ?? msg.sender.name,
        body: msg.body,
      });
    } else if (msg.senderId === instructorId) {
      void notifyRegistrationChatMessage({
        registrationId: id,
        messageId: msg.id,
        recipientId: clientId,
        recipientRole: "client",
        senderName: msg.sender.name,
        body: msg.body,
      });
    }
  }

  return NextResponse.json({ message: msg });
}
