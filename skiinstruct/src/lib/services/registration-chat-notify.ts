import { sendWebPushToUser } from "@/lib/push-web";
import { getPublicProductName } from "@/shared/lib/product";

function previewBody(body: string, max = 160): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "(пустое сообщение)";
  return compact.length > max ? `${compact.slice(0, max).trim()}…` : compact;
}

/** Push второй стороне в чате записи на мероприятие. */
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

  try {
    await sendWebPushToUser(params.recipientId, {
      title: `${appName}: сообщение по мероприятию`,
      body: `${senderLabel}: ${preview}`,
      url,
      tag: `registration-chat-${params.messageId}`,
      sound: "chat",
    });
  } catch (e) {
    console.error("[registration-chat-notify] push", e instanceof Error ? e.message : e);
  }
}
