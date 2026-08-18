import { sendWebPushToUser } from "@/lib/push-web";
import { createPushSnoozeToken } from "@/lib/support-push-token";
import { getPublicProductName } from "@/shared/lib/product";

function previewBody(body: string, max = 160): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "(пустое сообщение)";
  return compact.length > max ? `${compact.slice(0, max).trim()}…` : compact;
}

/** Push второй стороне в чате записи на событие. */
export async function notifyRegistrationChatMessage(params: {
  registrationId: string;
  messageId: string;
  recipientId: string;
  recipientRole: "client" | "instructor";
  senderName: string | null;
  body: string;
}): Promise<void> {
  const preview = previewBody(params.body);
  const senderLabel = params.senderName?.trim() || (params.recipientRole === "client" ? "Инструктор" : "Клиент");
  const appName = getPublicProductName();
  const url =
    params.recipientRole === "client"
      ? `/client/registrations/${params.registrationId}`
      : `/instructor/registrations/${params.registrationId}`;
  const title = `${appName}: сообщение по событию`;
  const body = `${senderLabel}: ${preview}`;
  const tag = `registration-chat-${params.messageId}`;
  const snoozeToken = createPushSnoozeToken({
    userId: params.recipientId,
    title,
    body,
    url,
    tag,
  });

  try {
    await sendWebPushToUser(params.recipientId, {
      title,
      body,
      url,
      tag,
      sound: "chat",
      snoozeToken: snoozeToken ?? undefined,
    });
  } catch (e) {
    console.error("[registration-chat-notify] push", e instanceof Error ? e.message : e);
  }
}
