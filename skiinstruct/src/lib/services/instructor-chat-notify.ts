import { publicSiteHostLabel } from "@/lib/app-origin";
import { sendWebPushToUser } from "@/lib/push-web";
import { getPublicProductName } from "@/shared/lib/product";

function previewBody(body: string, max = 160): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "(пустое сообщение)";
  return compact.length > max ? `${compact.slice(0, max).trim()}…` : compact;
}

/** Push инструктору, когда клиент написал в чат заказа (вкладка закрыта / фон). */
export async function notifyInstructorClientChatMessage(params: {
  orderId: string;
  messageId: string;
  instructorId: string;
  clientName: string | null;
  body: string;
}): Promise<void> {
  const preview = previewBody(params.body);
  const clientLabel = params.clientName?.trim() || "Клиент";
  const url = `/instructor/orders/${params.orderId}`;
  const siteLabel = publicSiteHostLabel();

  try {
    await sendWebPushToUser(params.instructorId, {
      title: `${getPublicProductName()}: сообщение от клиента`,
      body: `${clientLabel}: ${preview}. Откройте ${siteLabel}.`,
      url,
      tag: `instructor-chat-${params.messageId}`,
      sound: "chat",
      kind: "instructor-chat",
      orderId: params.orderId,
    });
  } catch (e) {
    console.error("[instructor-chat-notify] push", e instanceof Error ? e.message : e);
  }
}
