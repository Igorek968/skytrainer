import { prisma } from "@/lib/prisma";
import { sendSupportMessageToTelegram } from "@/lib/telegram-support";
import { ticketShortId } from "@/lib/support-ticket-access";

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

  const tg = await sendSupportMessageToTelegram({
    ticketId,
    ticketShort: ticketShortId(ticketId),
    userLabel: label,
    email,
    body,
  });

  if (tg.ok) {
    await prisma.supportMessage.update({
      where: { id: msg.id },
      data: { telegramMessageId: tg.messageId },
    });
  }

  return msg;
}
