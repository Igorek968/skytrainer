import { createChatPushReplyToken } from "@/lib/chat-push-reply-token";
import { sendWebPushToUser } from "@/lib/push-web";
import { createPushSnoozeToken } from "@/lib/support-push-token";
import { getPublicProductName } from "@/shared/lib/product";

function previewBody(body: string, max = 160): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "(пустое сообщение)";
  return compact.length > max ? `${compact.slice(0, max).trim()}…` : compact;
}

/** Push клиенту, когда инструктор написал в чат заказа. */
export async function notifyClientInstructorChatMessage(params: {
  orderId: string;
  messageId: string;
  clientId: string;
  instructorName: string | null;
  body: string;
}): Promise<void> {
  const preview = previewBody(params.body);
  const instructorLabel = params.instructorName?.trim() || "Инструктор";
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://твойтренер.рф";
  const url = `${origin}/client/orders/${params.orderId}#order-chat`;
  const appName = getPublicProductName();
  const title = `${appName}: сообщение от инструктора`;
  const body = `${instructorLabel}: ${preview}`;
  const tag = `client-chat-${params.messageId}`;
  const replyToken = createChatPushReplyToken(params.orderId, params.clientId);
  const snoozeToken = createPushSnoozeToken({
    userId: params.clientId,
    title,
    body,
    url: `/client/orders/${params.orderId}#order-chat`,
    tag,
  });

  try {
    await sendWebPushToUser(params.clientId, {
      title,
      body,
      url,
      tag,
      sound: "chat",
      kind: "client-chat",
      orderId: params.orderId,
      replyToken: replyToken ?? undefined,
      snoozeToken: snoozeToken ?? undefined,
    });
  } catch (e) {
    console.error("[client-chat-notify] push", e instanceof Error ? e.message : e);
  }
}
