import { LEGAL_AGENT } from "@/lib/legal-entity";

export const SUPPORT_TICKET_COOKIE = "skiinstruct_support_token";

/** Единый контакт поддержки / оператора (публичный). */
export const DEFAULT_SUPPORT_EMAIL = "tvoitrenerrf@yandex.ru";

/** Канал Telegram бренда. */
export const DEFAULT_SUPPORT_TELEGRAM_URL = "https://t.me/tvoitrenerrf";
export const SUPPORT_TELEGRAM_HANDLE = "@tvoitrenerrf";

/**
 * MAX — связь с администратором.
 * Переопределяется через NEXT_PUBLIC_SUPPORT_MAX_URL.
 */
export const DEFAULT_SUPPORT_MAX_URL = "https://max.ru/id110116757261_bot";

export function supportEmail(): string {
  const e = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return e || LEGAL_AGENT.email || DEFAULT_SUPPORT_EMAIL;
}

export function supportTelegramUrl(): string {
  const u = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL?.trim();
  return u || DEFAULT_SUPPORT_TELEGRAM_URL;
}

/**
 * WhatsApp поддержки. Задаётся через NEXT_PUBLIC_SUPPORT_WHATSAPP_URL
 * (например https://wa.me/79001234567) — без URL кнопка скрыта.
 */
export function supportWhatsAppUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL?.trim();
  return u || null;
}

export function supportMaxUrl(): string {
  const u = process.env.NEXT_PUBLIC_SUPPORT_MAX_URL?.trim();
  return u || DEFAULT_SUPPORT_MAX_URL;
}

export function isMaxSupportConfigured(): boolean {
  const token = process.env.MAX_BOT_TOKEN?.trim();
  const dest =
    process.env.MAX_SUPPORT_USER_ID?.trim() || process.env.MAX_SUPPORT_CHAT_ID?.trim();
  return Boolean(token && dest);
}

/** Reply-To для исходящих писем платформы (ответы пользователей → поддержка). */
export function smtpReplyTo(): string {
  return (
    process.env.SMTP_REPLY_TO?.trim() ||
    process.env.SKIINSTRUCT_SMTP_REPLY_TO?.trim() ||
    supportEmail()
  );
}
