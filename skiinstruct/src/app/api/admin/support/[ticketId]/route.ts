import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { writeAdminAudit } from "@/lib/services/admin-audit";
import { prisma } from "@/lib/prisma";
import {
  appendStaffSupportMessage,
  notifyUserSupportStaffMessage,
} from "@/lib/support-service";
import { ticketShortId } from "@/lib/support-ticket-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ticketId: string }> };

const patchSchema = z.object({
  action: z.enum(["reply", "close", "reopen"]),
  body: z.string().trim().min(1).max(4000).optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { ticketId } = await ctx.params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, phone: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 500,
        select: {
          id: true,
          body: true,
          authorRole: true,
          createdAt: true,
          messengerMessageId: true,
        },
      },
    },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Тикет не найден" }, { status: 404 });
  }

  const label =
    ticket.user?.name?.trim() ||
    ticket.user?.email ||
    ticket.guestName?.trim() ||
    ticket.guestEmail ||
    "Гость";

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      shortId: ticketShortId(ticket.id),
      status: ticket.status,
      userId: ticket.userId,
      user: ticket.user,
      guestEmail: ticket.guestEmail,
      guestName: ticket.guestName,
      label,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messages: ticket.messages.map((m) => ({
        id: m.id,
        body: m.body,
        authorRole: m.authorRole,
        createdAt: m.createdAt.toISOString(),
        messengerMessageId: m.messengerMessageId,
      })),
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { ticketId } = await ctx.params;
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

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return NextResponse.json({ error: "Тикет не найден" }, { status: 404 });
  }

  if (parsed.data.action === "close") {
    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "CLOSED" },
    });
    await writeAdminAudit({
      actorId: auth.userId,
      action: "support.close",
      entity: "SupportTicket",
      entityId: ticketId,
      summary: `Закрыт тикет ${ticketShortId(ticketId)}`,
    });
    return NextResponse.json({ ok: true, status: updated.status });
  }

  if (parsed.data.action === "reopen") {
    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "OPEN" },
    });
    await writeAdminAudit({
      actorId: auth.userId,
      action: "support.reopen",
      entity: "SupportTicket",
      entityId: ticketId,
      summary: `Открыт тикет ${ticketShortId(ticketId)}`,
    });
    return NextResponse.json({ ok: true, status: updated.status });
  }

  const text = parsed.data.body?.trim();
  if (!text) {
    return NextResponse.json({ error: "Введите текст ответа" }, { status: 400 });
  }

  if (ticket.status !== "OPEN") {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "OPEN" },
    });
  }

  const msg = await appendStaffSupportMessage(ticketId, text);
  if (ticket.userId) {
    await notifyUserSupportStaffMessage({
      userId: ticket.userId,
      ticketId,
      messageId: msg.id,
      body: text,
    });
  }

  await writeAdminAudit({
    actorId: auth.userId,
    action: "support.reply",
    entity: "SupportTicket",
    entityId: ticketId,
    summary: `Ответ в тикете ${ticketShortId(ticketId)}`,
  });

  return NextResponse.json({
    ok: true,
    message: {
      id: msg.id,
      body: msg.body,
      authorRole: msg.authorRole,
      createdAt: msg.createdAt.toISOString(),
    },
  });
}
