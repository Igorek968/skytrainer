import { prisma } from "@/lib/prisma";
import { sendSupportMessageToMax } from "@/lib/max-support";
import { sendWebPushToUser } from "@/lib/push-web";
import { ticketShortId } from "@/lib/support-ticket-access";
import { getPublicProductName } from "@/shared/lib/product";

function previewBody(body: string, max = 160): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "(пустое сообщение)";
  return compact.length > max ? `${compact.slice(0, max).trim()}…` : compact;
}

/** Открытый тикет пользователя или новый, если ещё нет. */
export async function ensureOpenSupportTicketForUser(userId: string) {
  const existing = await prisma.supportTicket.findFirst({
    where: { userId, status: "OPEN" },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  return prisma.supportTicket.create({
    data: { userId, status: "OPEN" },
  });
}

export async function appendStaffSupportMessage(ticketId: string, body: string) {
  const msg = await prisma.supportMessage.create({
    data: {
      ticketId,
      authorRole: "STAFF",
      body,
    },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  return msg;
}

/** Админ / оператор → сообщение в чат поддержки пользователя + push. */
export async function deliverStaffMessageToUserSupport(params: {
  userId: string;
  body: string;
  subject?: string | null;
  pushTitle?: string;
}) {
  const ticket = await ensureOpenSupportTicketForUser(params.userId);
  const text = params.subject?.trim()
    ? `Тема: ${params.subject.trim()}\n\n${params.body.trim()}`
    : params.body.trim();
  const msg = await appendStaffSupportMessage(ticket.id, text);
  await notifyUserSupportStaffMessage({
    userId: params.userId,
    messageId: msg.id,
    body: text,
    title: params.pushTitle,
  });
  return { ticket, msg };
}

export async function notifyUserSupportStaffMessage(params: {
  userId: string;
  messageId: string;
  body: string;
  title?: string;
}): Promise<void> {
  const appName = getPublicProductName();
  try {
    await sendWebPushToUser(params.userId, {
      title: (params.title?.trim() || `${appName}: сообщение поддержки`).slice(0, 80),
      body: previewBody(params.body),
      url: "/support",
      tag: `support-${params.messageId}`,
      sound: "chat",
    });
  } catch (e) {
    console.error("[support-notify] push", e instanceof Error ? e.message : e);
  }
}

export async function appendUserSupportMessage(
  ticketId: string,
  body: string,
  ctx: {
    userId: string | null;
    guestEmail: string | null;
    guestName: string | null;
    userName: string | null;
  },
) {
  const msg = await prisma.supportMessage.create({
    data: {
      ticketId,
      authorRole: "USER",
      body,
    },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  const email = ctx.guestEmail ?? "—";
  const label = ctx.userName || ctx.guestName || (ctx.userId ? "Пользователь" : "Гость");

  const max = await sendSupportMessageToMax({
    ticketId,
    ticketShort: ticketShortId(ticketId),
    userLabel: label,
    email,
    body,
  });

  if (max.ok) {
    await prisma.supportMessage.update({
      where: { id: msg.id },
      data: { messengerMessageId: max.messageId },
    });
  } else {
    console.error("[support] MAX bridge:", max.error);
  }

  return msg;
}
