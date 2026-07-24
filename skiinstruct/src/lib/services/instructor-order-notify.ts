import nodemailer from "nodemailer";
import type { LessonDuration } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createOrderPushActionToken } from "@/lib/order-push-action-token";
import { sendWebPushToUser } from "@/lib/push-web";
import { lessonDurationLabelRu, skillLevelLabelRu } from "@/shared/lib/order-booking-labels";
import { publicSiteHostLabel } from "@/lib/app-origin";
import { orderIsUrgent, URGENT_INSTRUCTOR_DEADLINE_MIN } from "@/shared/lib/order-flex";
import { getPublicProductName } from "@/shared/lib/product";
import { APP_TIME_ZONE } from "@/shared/lib/app-timezone";

function envSecret(value: string | undefined): string {
  const v = value?.trim() ?? "";
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function smtpConfigFromEnv() {
  const host = process.env.SMTP_HOST?.trim() ?? "smtp.beget.com";
  const user = envSecret(process.env.SMTP_USER);
  const pass = envSecret(process.env.SMTP_PASSWORD) || envSecret(process.env.SMTP_PASS);
  if (!user || !pass) return null;

  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 465;
  const secure =
    process.env.SMTP_SECURE === "0" || process.env.SMTP_SECURE === "false"
      ? false
      : port === 465 || process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true" || !portRaw;

  return {
    host,
    port: Number.isFinite(port) ? port : 465,
    secure,
    user,
    pass,
    requireTLS: !secure && (port === 587 || port === 2525),
  };
}

function formatDateTimeRu(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("ru-RU", { timeZone: APP_TIME_ZONE });
}

function formatDateRu(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("ru-RU", { timeZone: APP_TIME_ZONE });
}

function formatRub(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

type PendingOrderEmailPayload = {
  instructorName: string | null;
  clientName: string;
  duration: LessonDuration;
  skillLevel: string;
  disciplineLabel: string | null;
  amountRub: number | null;
  urgent: boolean;
  pendingExpiresAt: Date | null;
  requestedStartDate: Date | null;
  requestedEndDate: Date | null;
  requestedDays: number | null;
  flexibleInstructorInvite: boolean;
  orderUrl: string;
  appName: string;
};

function buildPendingOrderEmailContent(p: PendingOrderEmailPayload) {
  const greeting = p.instructorName ? `Здравствуйте, ${p.instructorName}!` : "Здравствуйте!";
  const durationLabel = lessonDurationLabelRu(p.duration);
  const skillLabel = skillLevelLabelRu(p.skillLevel);
  const discipline = p.disciplineLabel?.trim() || "—";

  let timingLine = `Длительность: ${durationLabel}`;
  if (p.requestedStartDate) {
    timingLine += `\nДата: ${formatDateRu(p.requestedStartDate)}`;
    if (p.requestedEndDate) {
      timingLine += ` — ${formatDateRu(p.requestedEndDate)}`;
    }
  }
  if ((p.requestedDays ?? 1) > 1) {
    timingLine += `\nДней: ${p.requestedDays}`;
  }

  const urgentBlock = p.urgent
    ? `\n⚡ Срочная заявка — ответьте в течение ${URGENT_INSTRUCTOR_DEADLINE_MIN} мин.${
        p.pendingExpiresAt ? ` Дедлайн: ${formatDateTimeRu(p.pendingExpiresAt)}.` : ""
      }`
    : p.flexibleInstructorInvite
      ? "\nЗапись на дату — без таймера ответа."
      : "";

  const subject = p.urgent
    ? `⚡ Срочная заявка от ${p.clientName} — ${p.appName}`
    : `Новая заявка на урок от ${p.clientName} — ${p.appName}`;

  const text = `${greeting}

Клиент ${p.clientName} оплатил заявку и ждёт вашего ответа.
${urgentBlock}

${timingLine}
Дисциплина: ${discipline}
Уровень: ${skillLabel}
Сумма: ${formatRub(p.amountRub)}

Откройте кабинет и примите или отклоните заявку:
${p.orderUrl}

— ${p.appName}`;

  const html = `<!DOCTYPE html>
<html lang="ru">
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
  <p>${greeting}</p>
  <p>Клиент <strong>${p.clientName.replace(/</g, "&lt;")}</strong> оплатил заявку и ждёт вашего ответа.</p>
  ${
    p.urgent
      ? `<p style="color:#c2410c;font-weight:600">⚡ Срочная заявка — ответьте в течение ${URGENT_INSTRUCTOR_DEADLINE_MIN} мин.${
          p.pendingExpiresAt
            ? ` Дедлайн: ${formatDateTimeRu(p.pendingExpiresAt).replace(/</g, "&lt;")}.`
            : ""
        }</p>`
      : p.flexibleInstructorInvite
        ? `<p style="color:#555">Запись на дату — без таймера ответа.</p>`
        : ""
  }
  <ul style="padding-left:1.2em">
    <li>Длительность: ${durationLabel}</li>
    ${
      p.requestedStartDate
        ? `<li>Дата: ${formatDateRu(p.requestedStartDate)}${
            p.requestedEndDate ? ` — ${formatDateRu(p.requestedEndDate)}` : ""
          }</li>`
        : ""
    }
    ${(p.requestedDays ?? 1) > 1 ? `<li>Дней: ${p.requestedDays}</li>` : ""}
    <li>Дисциплина: ${discipline.replace(/</g, "&lt;")}</li>
    <li>Уровень: ${skillLabel}</li>
    <li>Сумма: ${formatRub(p.amountRub)}</li>
  </ul>
  <p><a href="${p.orderUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Открыть заявку</a></p>
  <p style="font-size:12px;color:#666">Если сайт закрыт — это письмо и push-уведомление дублируют оповещение в кабинете.</p>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Email + Web Push инструктору при переходе заказа в PENDING_INSTRUCTOR (сайт может быть закрыт).
 * Помечаем отправленным только после успешного push или email — иначе повтор при следующем вызове.
 */
export async function notifyInstructorOfPendingOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      client: { select: { name: true } },
    },
  });
  if (!order?.instructor || order.status !== "PENDING_INSTRUCTOR" || !order.instructorId) return false;
  if (order.instructorPendingNotifiedAt) return false;

  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://твойтренер.рф";
  const siteHost = publicSiteHostLabel();
  const orderUrl = `${origin}/instructor/orders/${orderId}`;
  const appName = getPublicProductName();
  const clientName = order.client?.name?.trim() || "Клиент";
  const amountRub = order.amountTotal != null ? Number(order.amountTotal) : null;
  const urgent = orderIsUrgent(order);
  const durationLabel = lessonDurationLabelRu(order.duration);

  const pushTitle = urgent ? `⚡ Срочная заявка — ${appName}` : `Новая заявка — ${appName}`;
  const pushBody = `${clientName} · ${durationLabel}${amountRub != null ? ` · ${formatRub(amountRub)}` : ""}. Перейдите на ${siteHost}.`;
  const actionToken = createOrderPushActionToken(orderId, order.instructor.id);

  let pushSent = 0;
  try {
    const pushResult = await sendWebPushToUser(order.instructor.id, {
      title: pushTitle,
      body: pushBody,
      url: orderUrl,
      tag: `instructor-order-${orderId}`,
      kind: "instructor-order",
      sound: "order",
      orderId,
      actionToken: actionToken ?? undefined,
    });
    pushSent = pushResult.sent;
    if (pushResult.sent === 0 && pushResult.errors === 0) {
      console.info("[instructor-order-notify] no push subscriptions for instructor", order.instructor.id);
    }
  } catch (e) {
    console.error("[instructor-order-notify] push", e instanceof Error ? e.message : e);
  }

  let emailSent = false;
  if (order.instructor.email) {
    const cfg = smtpConfigFromEnv();
    if (cfg) {
      const { subject, text, html } = buildPendingOrderEmailContent({
        instructorName: order.instructor.name,
        clientName,
        duration: order.duration,
        skillLevel: order.skillLevel,
        disciplineLabel: order.disciplineLabel,
        amountRub,
        urgent,
        pendingExpiresAt: order.pendingExpiresAt,
        requestedStartDate: order.requestedStartDate,
        requestedEndDate: order.requestedEndDate,
        requestedDays: order.requestedDays,
        flexibleInstructorInvite: order.flexibleInstructorInvite,
        orderUrl,
        appName,
      });

      const from =
        process.env.SMTP_FROM?.trim() ||
        process.env.SKIINSTRUCT_SMTP_FROM?.trim() ||
        process.env.PASSWORD_RESET_EMAIL_FROM?.trim() ||
        `${appName} <noreply@localhost>`;

      try {
        const transport = nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          requireTLS: cfg.requireTLS,
          auth: { user: cfg.user, pass: cfg.pass },
        });
        await transport.sendMail({
          from,
          to: order.instructor.email,
          subject,
          text,
          html,
        });
        emailSent = true;
      } catch (e) {
        console.error("[instructor-order-notify] email", e instanceof Error ? e.message : e);
      }
    } else {
      console.info("[instructor-order-notify] SMTP not configured, skip email");
    }
  }

  if (pushSent > 0 || emailSent) {
    await prisma.order.updateMany({
      where: { id: orderId, instructorPendingNotifiedAt: null },
      data: { instructorPendingNotifiedAt: new Date() },
    });
    return true;
  }

  return false;
}
