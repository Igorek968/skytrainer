import { sendWebPushToUser } from "@/lib/push-web";
import { getPublicProductName } from "@/shared/lib/product";

/** Push инструктору после решения по заявке на модерацию. */
export async function notifyInstructorVerificationResult(params: {
  userId: string;
  status: "APPROVED" | "REJECTED";
  rejectMessage?: string | null;
}): Promise<void> {
  const product = getPublicProductName();
  const approved = params.status === "APPROVED";
  const title = approved
    ? `${product}: заявка одобрена`
    : `${product}: заявка отклонена`;
  const body = approved
    ? "Анкета прошла модерацию. Откройте кабинет инструктора, чтобы принимать заказы."
    : params.rejectMessage?.trim()
      ? `Причина: ${params.rejectMessage.trim()}`
      : "Администратор отклонил заявку. Откройте страницу ожидания, чтобы увидеть комментарий.";
  const url = approved ? "/instructor" : "/instructor/pending";

  try {
    await sendWebPushToUser(params.userId, {
      title,
      body,
      url,
      tag: `instructor-verification-${params.status.toLowerCase()}`,
      sound: approved ? "order" : "reminder",
    });
  } catch (e) {
    console.error(
      "[instructor-verification-notify] push",
      e instanceof Error ? e.message : e,
    );
  }
}
