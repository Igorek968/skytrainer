import { createChatPushReplyToken } from "@/lib/chat-push-reply-token";
import { sendWebPushToUser } from "@/lib/push-web";
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
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://utrainer.ru";
  const url = `${origin}/client/orders/${params.orderId}#order-chat`;
  const appName = getPublicProductName();
  const replyToken = createChatPushReplyToken(params.orderId, params.clientId);

  try {
    await sendWebPushToUser(params.clientId, {
      title: `${appName}: сообщение от инструктора`,
      body: `${instructorLabel}: ${preview}`,
      url,
      tag: `client-chat-${params.messageId}`,
      sound: "chat",
      kind: "client-chat",
      orderId: params.orderId,
      replyToken: replyToken ?? undefined,
    });
  } catch (e) {
    console.error("[client-chat-notify] push", e instanceof Error ? e.message : e);
  }
}
