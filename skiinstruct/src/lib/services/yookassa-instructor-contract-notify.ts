import nodemailer from "nodemailer";

import {
  fetchAgencyCertificateData,
  renderAgencyCertificateHtml,
} from "@/lib/instructor-agency-registry";
import { LEGAL_PLATFORM_URL } from "@/lib/legal-config";
import { prisma } from "@/lib/prisma";
import { smtpReplyTo } from "@/lib/support-config";
import { getPublicProductName } from "@/shared/lib/product";

function envSecret(value: string | undefined): string {
  const v = value?.trim() ?? "";
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function smtpConfigFromEnv(): {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  requireTLS?: boolean;
} | null {
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

  const requireTLS = !secure && (port === 587 || port === 2525);
  return {
    host,
    port: Number.isFinite(port) ? port : 465,
    secure,
    user,
    pass,
    ...(requireTLS ? { requireTLS: true } : {}),
  };
}

/** Куда слать заполненные договоры для пакета ЮKassa (ops / бухгалтерия). */
export function yookassaDocsRecipient(): string | null {
  const to =
    process.env.YOOKASSA_DOCS_EMAIL?.trim() ||
    process.env.ADMIN_ALERT_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    null;
  return to || null;
}

export function isYookassaContractNotifyConfigured(): boolean {
  return Boolean(smtpConfigFromEnv() && yookassaDocsRecipient());
}

export type NotifyYookassaContractResult =
  | { ok: true; skipped?: false; to: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

/**
 * Сформировать заполненный агентский договор и отправить на почту ops.
 * ЮKassa API договоров не принимает — письмо готовит пакет для ручной передачи в поддержку.
 */
export async function notifyYookassaInstructorContract(
  userId: string,
  options?: { force?: boolean },
): Promise<NotifyYookassaContractResult> {
  const profile = await prisma.instructorProfile.findUnique({
    where: { userId },
    select: {
      agencyOfferAcceptedAt: true,
      yookassaContractNotifiedAt: true,
    },
  });

  if (!profile) {
    return { ok: false, error: "Профиль инструктора не найден" };
  }
  if (!profile.agencyOfferAcceptedAt) {
    return { ok: true, skipped: true, reason: "нет акцепта оферты" };
  }
  if (profile.yookassaContractNotifiedAt && !options?.force) {
    return { ok: true, skipped: true, reason: "уже отправлено" };
  }

  const to = yookassaDocsRecipient();
  const smtp = smtpConfigFromEnv();
  if (!to || !smtp) {
    return {
      ok: false,
      error: "Задайте SMTP_* и YOOKASSA_DOCS_EMAIL (или ADMIN_ALERT_EMAIL / SMTP_USER)",
    };
  }

  const data = await fetchAgencyCertificateData(userId);
  if (!data) {
    return { ok: false, error: "Не удалось собрать данные договора" };
  }

  const html = renderAgencyCertificateHtml(data);
  const name = data.instructor.name?.trim() || data.instructor.email;
  const safeFile = `agent-dogovor-${userId}.html`;
  const appName = getPublicProductName();
  const from =
    process.env.PASSWORD_RESET_EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    `${appName} <${smtp.user}>`;

  const text = [
    `Новый / обновлённый агентский договор инструктора для пакета ЮKassa.`,
    ``,
    `ФИО: ${name}`,
    `Email: ${data.instructor.email}`,
    `ИНН: ${data.instructor.inn ?? "—"}`,
    `Налог: ${data.instructor.taxStatus ?? "—"}`,
    `Акцепт: ${data.instructor.agencyOfferAcceptedAt ?? "—"}`,
    `Версия оферты: ${data.instructor.agencyOfferVersion ?? data.offerVersion}`,
    `Статус анкеты: ${data.instructor.verificationStatus}`,
    ``,
    `Заполненный договор — во вложении (HTML → Печать → PDF).`,
    `Реестр: ${LEGAL_PLATFORM_URL}/admin/compliance`,
    `Сертификат: ${LEGAL_PLATFORM_URL}/api/admin/agency-registry/${userId}/certificate`,
    ``,
    `Дальше: приложите PDF к обращению в поддержку ЮKassa и отметьте «Передано в ЮKassa» в админке.`,
  ].join("\n");

  try {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: smtp.requireTLS,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transport.sendMail({
      from,
      to,
      replyTo: smtpReplyTo(),
      subject: `[ЮKassa] Агентский договор — ${name}`,
      text,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</pre>`,
      attachments: [
        {
          filename: safeFile,
          content: html,
          contentType: "text/html; charset=utf-8",
        },
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[yookassa-contract] SMTP failed for ${userId}:`, msg);
    return { ok: false, error: msg };
  }

  await prisma.instructorProfile.update({
    where: { userId },
    data: { yookassaContractNotifiedAt: new Date() },
  });

  console.info(`[yookassa-contract] notified ${userId} → ${to}`);
  return { ok: true, to };
}

export async function markYookassaInstructorContractSent(userId: string): Promise<void> {
  await prisma.instructorProfile.update({
    where: { userId },
    data: { yookassaContractMarkedSentAt: new Date() },
  });
}

/** Разовая / пакетная отправка по всем с акцептом и без notifiedAt. */
export async function notifyPendingYookassaInstructorContracts(options?: {
  force?: boolean;
  limit?: number;
}): Promise<{ total: number; sent: number; skipped: number; failed: number; errors: string[] }> {
  const limit = options?.limit ?? 200;
  const where = options?.force
    ? { agencyOfferAcceptedAt: { not: null } }
    : { agencyOfferAcceptedAt: { not: null }, yookassaContractNotifiedAt: null };

  const profiles = await prisma.instructorProfile.findMany({
    where,
    select: { userId: true },
    orderBy: { agencyOfferAcceptedAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const p of profiles) {
    const r = await notifyYookassaInstructorContract(p.userId, { force: options?.force });
    if (r.ok && r.skipped) skipped += 1;
    else if (r.ok) sent += 1;
    else {
      failed += 1;
      errors.push(`${p.userId}: ${r.error}`);
    }
  }

  return { total: profiles.length, sent, skipped, failed, errors };
}
