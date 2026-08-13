import { domainToASCII } from "node:url";

import { getPublicProductName } from "@/shared/lib/product";

export type SmtpFromAddress = {
  name: string;
  address: string;
};

/** Достаёт только email из `Name <email>` или голого адреса (кириллицу в имени игнорируем). */
export function extractSmtpEmailAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const angle = trimmed.match(/<([^<>@\s]+@[^<>@\s]+)>/);
  if (angle?.[1]) return angle[1].trim();
  const bare = trimmed.match(/^([^\s<>"]+@[^\s<>"]+)$/);
  if (bare?.[1]) return bare[1].trim();
  const any = trimmed.match(/[^\s<>"]+@[^\s<>"]+/);
  return any?.[0]?.trim() || null;
}

/** Локальная часть + punycode для IDN-домена (твойтренер.рф → xn--...). */
export function normalizeSmtpEmailAddress(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return email.trim();
  const local = email.slice(0, at).trim();
  const domain = email.slice(at + 1).trim().replace(/\.$/, "");
  if (!local || !domain) return email.trim();
  try {
    const ascii = domainToASCII(domain);
    return `${local}@${ascii || domain}`;
  } catch {
    return `${local}@${domain}`;
  }
}

/**
 * From для писем: отображаемое имя всегда из кода (UTF-8),
 * адрес — из SMTP_FROM / PASSWORD_RESET_EMAIL_FROM / SMTP_USER.
 *
 * Кириллица в .env на Windows → Docker часто превращается в «пїЅпїЅ…» в From;
 * тема/тело при этом нормальные, т.к. собираются в коде.
 */
export function resolveSmtpFrom(): SmtpFromAddress {
  const name = getPublicProductName();
  const raw =
    process.env.PASSWORD_RESET_EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.SKIINSTRUCT_SMTP_FROM?.trim() ||
    "";
  const fromEnv = extractSmtpEmailAddress(raw);
  const user = process.env.SMTP_USER?.trim() || process.env.SKIINSTRUCT_SMTP_USER?.trim() || "";
  const address = normalizeSmtpEmailAddress(fromEnv || user || "noreply@localhost");
  return { name, address };
}

/** Строка для webhook/логов: Name <addr> (nodemailer сам MIME-кодирует объект From). */
export function formatSmtpFromHeader(from: SmtpFromAddress = resolveSmtpFrom()): string {
  const safeName = from.name.replace(/[\r\n"]/g, "").trim() || "App";
  return `${safeName} <${from.address}>`;
}
