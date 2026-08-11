import { sendWebPushToUser } from "@/lib/push-web";
import { getPublicProductName } from "@/shared/lib/product";

/** Push клиенту: инструктор принял / отклонил / заявка истекла. */
export async function notifyClientOrderDecision(params: {
  clientId: string;
  orderId: string;
  decision: "accepted" | "rejected" | "expired";
  instructorName?: string | null;
}): Promise<void> {
  const app = getPublicProductName();
  const name = params.instructorName?.trim() || "Инструктор";
  const url = `/client/orders/${params.orderId}`;

  let title: string;
  let body: string;
  if (params.decision === "accepted") {
    title = `${app}: заявка принята`;
    body = `${name} принял(а) вашу заявку. Откройте заказ для деталей.`;
  } else if (params.decision === "rejected") {
    title = `${app}: ищем другого инструктора`;
    body = `${name} не смог принять заявку. Ищем следующего подходящего специалиста.`;
  } else {
    title = `${app}: заявка закрыта`;
    body = "Время ответа истекло или заявка отменена. Откройте заказ или создайте новый.";
  }

  try {
    await sendWebPushToUser(params.clientId, {
      title,
      body,
      url,
      tag: `client-order-${params.decision}-${params.orderId}`,
      kind: "lesson-reminder",
      orderId: params.orderId,
      sound: params.decision === "accepted" ? "order" : "reminder",
    });
  } catch (e) {
    console.error("[client-order-notify] push", e instanceof Error ? e.message : e);
  }
}
