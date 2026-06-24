import webpush from "web-push";

import { prisma } from "@/lib/prisma";

let vapidConfigured = false;

export function isWebPushConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  return Boolean(pub && priv);
}

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:skiinstruct@localhost";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Тип push для service worker (кнопки, приоритет). */
  kind?: "instructor-order" | "lesson-reminder" | "instructor-chat" | "client-chat";
  orderId?: string;
  actionToken?: string;
  replyToken?: string;
  /** start | end — кнопки в push для инструктора. */
  lessonPhase?: "start" | "end";
  sound?: "order" | "chat" | "reminder";
};

export async function sendWebPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; errors: number }> {
  if (!ensureVapid()) return { sent: 0, errors: 0 };

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let errors = 0;
  const body = JSON.stringify(payload);

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        /** Достаточно долго, если cron отстаёт; браузер доставит при следующем онлайн. */
        { TTL: 86_400, urgency: "high" },
      );
      sent += 1;
    } catch (e: unknown) {
      errors += 1;
      const status = typeof e === "object" && e !== null && "statusCode" in e ? (e as { statusCode?: number }).statusCode : undefined;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: s.id } }).catch(() => {});
      }
    }
  }
  return { sent, errors };
}
