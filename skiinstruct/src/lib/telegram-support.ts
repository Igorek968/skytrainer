/**
 * Двусторонняя связь: веб-чат поддержки ↔ Telegram (ответ оператора через reply на сообщение бота).
 */

import { prisma } from "@/lib/prisma";

function botToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t || null;
}

function supportChatId(): string | null {
  const id = process.env.TELEGRAM_SUPPORT_CHAT_ID?.trim();
  return id || null;
}

export function isTelegramBridgeEnabled(): boolean {
  return Boolean(botToken() && supportChatId());
}

type TelegramSendResult = { ok: true; messageId: bigint } | { ok: false; error: string };

export async function sendSupportMessageToTelegram(input: {
  ticketId: string;
  ticketShort: string;
  userLabel: string;
  email: string;
  body: string;
}): Promise<TelegramSendResult> {
  const token = botToken();
  const chatId = supportChatId();
  if (!token || !chatId) {
    return { ok: false, error: "Telegram не настроен (TELEGRAM_BOT_TOKEN / TELEGRAM_SUPPORT_CHAT_ID)" };
  }

  const text = [
    `🆘 Поддержка #${input.ticketShort}`,
    `👤 ${input.userLabel}`,
    `📧 ${input.email}`,
    "",
    input.body,
    "",
    "↩️ Ответьте реплаем (Reply) на это сообщение — ответ уйдёт пользователю в веб-чат.",
  ].join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!res.ok || !data.ok || data.result?.message_id == null) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: BigInt(data.result.message_id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}

/** Обработка входящего update от Telegram Bot API (webhook). */
export async function handleTelegramSupportUpdate(update: unknown): Promise<void> {
  if (!update || typeof update !== "object") return;
  const msg = (update as { message?: TelegramIncomingMessage }).message;
  if (!msg?.text?.trim() || !msg.reply_to_message?.message_id) return;

  const repliedId = BigInt(msg.reply_to_message.message_id);
  const anchor = await prisma.supportMessage.findFirst({
    where: { telegramMessageId: repliedId },
    select: { ticketId: true },
  });
  if (!anchor) return;

  await prisma.supportMessage.create({
    data: {
      ticketId: anchor.ticketId,
      authorRole: "STAFF",
      body: msg.text.trim(),
    },
  });

  await prisma.supportTicket.update({
    where: { id: anchor.ticketId },
    data: { updatedAt: new Date() },
  });
}

type TelegramIncomingMessage = {
  message_id?: number;
  text?: string;
  reply_to_message?: { message_id?: number };
};
