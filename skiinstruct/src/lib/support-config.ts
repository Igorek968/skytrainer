export const SUPPORT_TICKET_COOKIE = "skiinstruct_support_token";

export function supportTelegramUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL?.trim();
  return u || null;
}

export function supportEmail(): string | null {
  const e = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return e || null;
}

export function isTelegramSupportConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_SUPPORT_CHAT_ID?.trim());
}
