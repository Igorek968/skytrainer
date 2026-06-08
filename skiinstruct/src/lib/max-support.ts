/**
 * Двусторонняя связь: веб-чат поддержки ↔ MAX (ответ оператора через Reply на сообщение бота).
 * API: https://dev.max.ru/docs-api
 */

import { prisma } from "@/lib/prisma";

const MAX_API = "https://platform-api.max.ru";

function botToken(): string | null {
  const t = process.env.MAX_BOT_TOKEN?.trim();
  return t || null;
}

/** Куда дублировать обращения: личный чат оператора (user_id) или группа (chat_id). */
function supportDestination(): { kind: "user" | "chat"; id: string } | null {
  const userId = process.env.MAX_SUPPORT_USER_ID?.trim();
  if (userId) return { kind: "user", id: userId };
  const chatId = process.env.MAX_SUPPORT_CHAT_ID?.trim();
  if (chatId) return { kind: "chat", id: chatId };
  return null;
}

export function isMaxBridgeEnabled(): boolean {
  return Boolean(botToken() && supportDestination());
}

type MaxSendResult = { ok: true; messageId: string } | { ok: false; error: string };

export async function sendSupportMessageToMax(input: {
  ticketId: string;
  ticketShort: string;
  userLabel: string;
  email: string;
  body: string;
}): Promise<MaxSendResult> {
  const token = botToken();
  const dest = supportDestination();
  if (!token || !dest) {
    return {
      ok: false,
      error: "MAX не настроен (MAX_BOT_TOKEN и MAX_SUPPORT_USER_ID или MAX_SUPPORT_CHAT_ID)",
    };
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

  const query = dest.kind === "user" ? `user_id=${dest.id}` : `chat_id=${dest.id}`;

  try {
    const res = await fetch(`${MAX_API}/messages?${query}`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: text.slice(0, 4000) }),
    });
    const data = (await res.json()) as {
      message?: { body?: { mid?: string } };
      code?: string;
      message_text?: string;
    };
    const mid = data.message?.body?.mid;
    if (!res.ok || !mid) {
      const err = data.message_text ?? data.code ?? `HTTP ${res.status}`;
      console.error("[max support] send failed:", err, { dest, status: res.status });
      return { ok: false, error: err };
    }
    return { ok: true, messageId: mid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}

function replyAnchorMid(update: unknown): string | null {
  if (!update || typeof update !== "object") return null;
  const u = update as MaxWebhookUpdate;
  if (u.update_type !== "message_created") return null;

  const msg = u.message;
  const text = msg?.body?.text?.trim();
  if (!text || !msg?.link) return null;

  // MAX LinkedMessage: { type: "reply", message: { mid, text, seq } } — см. max-bot-api-client-ts
  const linked = msg.link;
  if (linked.type && linked.type !== "reply") return null;

  return (
    linked.message?.mid ??
    linked.message?.body?.mid ??
    linked.body?.mid ??
    linked.mid ??
    null
  );
}

/** Обработка входящего update от MAX Bot API (webhook). */
export async function handleMaxSupportUpdate(update: unknown): Promise<void> {
  const u = update as MaxWebhookUpdate;
  if (u.message?.sender?.is_bot) return;

  const repliedMid = replyAnchorMid(update);
  if (!repliedMid) return;

  const text = (update as MaxWebhookUpdate).message?.body?.text?.trim();
  if (!text) return;

  const anchor = await prisma.supportMessage.findFirst({
    where: { messengerMessageId: repliedMid },
    select: { ticketId: true },
  });
  if (!anchor) {
    console.warn("[max support] reply anchor not found for mid:", repliedMid);
    return;
  }

  await prisma.supportMessage.create({
    data: {
      ticketId: anchor.ticketId,
      authorRole: "STAFF",
      body: text,
    },
  });

  await prisma.supportTicket.update({
    where: { id: anchor.ticketId },
    data: { updatedAt: new Date() },
  });
}

type MaxWebhookUpdate = {
  update_type?: string;
  message?: {
    sender?: { is_bot?: boolean };
    body?: { mid?: string; text?: string };
    link?: {
      type?: string;
      mid?: string;
      body?: { mid?: string };
      message?: { mid?: string; body?: { mid?: string } };
    };
  };
};
