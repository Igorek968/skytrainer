import nodemailer from "nodemailer";

import { formatEventDateRu, formatSlotTimeRu } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

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

export type EventRegistrationNotifyPayload = {
  instructorEmail: string;
  instructorName: string | null;
  clientName: string | null;
  clientEmail: string | null;
  eventTitle: string;
  eventBody: string;
  eventAt: Date | null;
  slotStartsAt: Date | null;
  amountRub: number;
  paidCount: number;
  maxSeats: number | null;
  panelUrl: string;
};

export function buildEventRegistrationEmailContent(p: EventRegistrationNotifyPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "uTrainer";
  const when = p.slotStartsAt
    ? `${formatEventDateRu(p.slotStartsAt.toISOString())} (${formatSlotTimeRu(p.slotStartsAt)})`
    : formatEventDateRu(p.eventAt?.toISOString() ?? null) ?? "дата не указана";

  const seats =
    p.maxSeats != null ? `${p.paidCount} из ${p.maxSeats}` : `${p.paidCount} участник(ов)`;

  const priceLine =
    p.amountRub > 0 ? `${p.amountRub.toLocaleString("ru-RU")} ₽ (оплата после мероприятия)` : "Бесплатно";

  const clientLine = [p.clientName?.trim(), p.clientEmail?.trim()].filter(Boolean).join(" · ") || "Клиент";

  const subject = `${appName}: новая запись — ${p.eventTitle}`;

  const text = [
    `Здравствуйте${p.instructorName ? `, ${p.instructorName}` : ""}!`,
    "",
    "Новая запись на ваше мероприятие:",
    "",
    `«${p.eventTitle}»`,
    `Когда: ${when}`,
    `Участник: ${clientLine}`,
    `Стоимость: ${priceLine}`,
    `Заполненность: ${seats}`,
    "",
    "Описание:",
    p.eventBody.slice(0, 2000),
    "",
    `Кабинет инструктора: ${p.panelUrl}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="ru">
<body style="font-family:sans-serif;line-height:1.5;color:#111;max-width:560px">
  <p>Здравствуйте${p.instructorName ? `, ${p.instructorName}` : ""}!</p>
  <p><strong>Новая запись</strong> на мероприятие «${p.eventTitle}».</p>
  <table style="border-collapse:collapse;margin:12px 0;font-size:14px">
    <tr><td style="padding:4px 12px 4px 0;color:#555">Когда</td><td><strong>${when}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#555">Участник</td><td>${clientLine}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#555">Стоимость</td><td>${priceLine}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#555">Места</td><td>${seats}</td></tr>
  </table>
  <p style="font-size:14px;color:#333;white-space:pre-wrap">${p.eventBody.slice(0, 1500).replace(/</g, "&lt;")}</p>
  <p><a href="${p.panelUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Открыть участников</a></p>
</body>
</html>`;

  return { subject, text, html };
}

export async function notifyInstructorOfEventRegistration(registrationId: string): Promise<boolean> {
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      client: { select: { name: true, email: true } },
      slot: { select: { startsAt: true, maxSeats: true } },
      event: {
        select: {
          id: true,
          title: true,
          body: true,
          eventAt: true,
          instructor: { select: { name: true, email: true } },
          slots: { select: { id: true } },
        },
      },
    },
  });

  if (!reg?.event.instructor.email) return false;

  const cfg = smtpConfigFromEnv();
  if (!cfg) {
    console.info("[event-registration-notify] SMTP not configured, skip email");
    return false;
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3001";
  const panelUrl = `${origin}/instructor`;

  const paidCount = reg.slotId
    ? await prisma.eventRegistration.count({
        where: {
          slotId: reg.slotId,
          status: { in: ["PAID", "PENDING_PAYMENT"] },
        },
      })
    : await prisma.eventRegistration.count({
        where: {
          eventId: reg.eventId,
          status: { in: ["PAID", "PENDING_PAYMENT"] },
        },
      });

  const { subject, text, html } = buildEventRegistrationEmailContent({
    instructorEmail: reg.event.instructor.email,
    instructorName: reg.event.instructor.name,
    clientName: reg.client.name,
    clientEmail: reg.client.email,
    eventTitle: reg.event.title,
    eventBody: reg.event.body,
    eventAt: reg.event.eventAt,
    slotStartsAt: reg.slot?.startsAt ?? null,
    amountRub: Number(reg.amountRub),
    paidCount,
    maxSeats: reg.slot?.maxSeats ?? null,
    panelUrl,
  });

  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "uTrainer";
  const from =
    process.env.SMTP_FROM?.trim() ||
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
      to: reg.event.instructor.email,
      subject,
      text,
      html,
    });
    return true;
  } catch (e) {
    console.error("[event-registration-notify]", e instanceof Error ? e.message : e);
    return false;
  }
}
