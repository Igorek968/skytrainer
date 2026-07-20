import { prisma } from "@/lib/prisma";
import {
  isPasswordResetEmailConfigured,
  passwordResetEmailDefaults,
  sendPasswordResetEmailViaSmtp,
  sendPasswordResetEmailViaWebhook,
} from "@/lib/services/password-reset-email";
import { deliverStaffMessageToUserSupport } from "@/lib/support-service";
import { getPublicProductName } from "@/shared/lib/product";

const BODY_MAX = 4000;
const SUBJECT_MAX = 200;

export type SendAdminDirectMessageParams = {
  senderId: string;
  recipientId: string;
  body: string;
  subject?: string | null;
};

export type SendAdminDirectMessageResult =
  | {
      ok: true;
      message: {
        id: string;
        recipientId: string;
        recipientEmail: string;
        subject: string | null;
        body: string;
        emailSent: boolean;
        createdAt: string;
      };
    }
  | { ok: false; error: string; status: number };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAdminDirectMessageEmailContent(params: {
  recipientName: string | null;
  subject: string | null;
  body: string;
  appName: string;
}): { subject: string; text: string; html: string } {
  const greeting = params.recipientName?.trim()
    ? `Здравствуйте, ${params.recipientName.trim()}!`
    : "Здравствуйте!";
  const topic = params.subject?.trim() || "Сообщение от администрации";
  const mailSubject = `${topic} — ${params.appName}`;

  const text = [
    greeting,
    "",
    `Вам сообщение от администрации ${params.appName}:`,
    "",
    params.subject?.trim() ? `Тема: ${params.subject.trim()}` : null,
    params.body.trim(),
    "",
    `— ${params.appName}`,
  ]
    .filter((line): line is string => line != null)
    .join("\n");

  const bodyHtml = escapeHtml(params.body.trim()).replace(/\n/g, "<br/>");
  const subjectHtml = params.subject?.trim()
    ? `<p style="margin:0 0 12px"><strong>Тема:</strong> ${escapeHtml(params.subject.trim())}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ru">
<body style="font-family:sans-serif;line-height:1.5;color:#111">
  <p>${escapeHtml(greeting)}</p>
  <p>Вам сообщение от администрации <strong>${escapeHtml(params.appName)}</strong>:</p>
  ${subjectHtml}
  <div style="padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">${bodyHtml}</div>
  <p style="font-size:13px;color:#555;margin-top:16px">— ${escapeHtml(params.appName)}</p>
</body>
</html>`;

  return { subject: mailSubject, text, html };
}

async function trySendAdminMessageEmail(params: {
  to: string;
  recipientName: string | null;
  subject: string | null;
  body: string;
}): Promise<boolean> {
  if (!isPasswordResetEmailConfigured()) return false;

  const appName = getPublicProductName();
  const { from } = passwordResetEmailDefaults();
  const content = buildAdminDirectMessageEmailContent({
    recipientName: params.recipientName,
    subject: params.subject,
    body: params.body,
    appName,
  });
  const payload = {
    to: params.to,
    from,
    subject: content.subject,
    text: content.text,
    html: content.html,
  };

  if (await sendPasswordResetEmailViaSmtp(payload)) return true;
  if (await sendPasswordResetEmailViaWebhook(payload)) return true;
  return false;
}

export async function sendAdminDirectMessage(
  params: SendAdminDirectMessageParams,
): Promise<SendAdminDirectMessageResult> {
  const body = params.body.trim();
  if (body.length < 1 || body.length > BODY_MAX) {
    return { ok: false, error: `Текст сообщения: 1–${BODY_MAX} символов`, status: 400 };
  }

  const subjectRaw = params.subject?.trim() || null;
  if (subjectRaw && subjectRaw.length > SUBJECT_MAX) {
    return { ok: false, error: `Тема: максимум ${SUBJECT_MAX} символов`, status: 400 };
  }

  if (params.recipientId === params.senderId) {
    return { ok: false, error: "Нельзя отправить сообщение самому себе", status: 400 };
  }

  const recipient = await prisma.user.findUnique({
    where: { id: params.recipientId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!recipient) {
    return { ok: false, error: "Пользователь не найден", status: 404 };
  }

  const emailSent = await trySendAdminMessageEmail({
    to: recipient.email,
    recipientName: recipient.name,
    subject: subjectRaw,
    body,
  });

  const row = await prisma.adminDirectMessage.create({
    data: {
      senderId: params.senderId,
      recipientId: recipient.id,
      subject: subjectRaw,
      body,
      emailSentAt: emailSent ? new Date() : null,
    },
    select: {
      id: true,
      recipientId: true,
      subject: true,
      body: true,
      emailSentAt: true,
      createdAt: true,
    },
  });

  const appName = getPublicProductName();
  const pushTitle = subjectRaw?.trim() || `Сообщение от ${appName}`;
  // Дублируем в чат поддержки получателя + push (сайт и телефон).
  try {
    await deliverStaffMessageToUserSupport({
      userId: recipient.id,
      body,
      subject: subjectRaw,
      pushTitle,
    });
  } catch (e) {
    console.error(
      "[admin-direct-message] support inbox",
      e instanceof Error ? e.message : e,
    );
  }

  return {
    ok: true,
    message: {
      id: row.id,
      recipientId: row.recipientId,
      recipientEmail: recipient.email,
      subject: row.subject,
      body: row.body,
      emailSent: Boolean(row.emailSentAt),
      createdAt: row.createdAt.toISOString(),
    },
  };
}

export async function listAdminDirectMessages(params?: { take?: number }) {
  const take = Math.min(Math.max(params?.take ?? 50, 1), 100);
  const rows = await prisma.adminDirectMessage.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      subject: true,
      body: true,
      emailSentAt: true,
      createdAt: true,
      sender: { select: { id: true, email: true, name: true } },
      recipient: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    body: r.body,
    emailSent: Boolean(r.emailSentAt),
    emailSentAt: r.emailSentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    sender: r.sender,
    recipient: r.recipient,
  }));
}
