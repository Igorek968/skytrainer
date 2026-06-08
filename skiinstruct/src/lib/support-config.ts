export const SUPPORT_TICKET_COOKIE = "skiinstruct_support_token";

export function supportMaxUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_SUPPORT_MAX_URL?.trim();
  return u || null;
}

export function supportEmail(): string | null {
  const e = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return e || null;
}

export function isMaxSupportConfigured(): boolean {
  const token = process.env.MAX_BOT_TOKEN?.trim();
  const dest =
    process.env.MAX_SUPPORT_USER_ID?.trim() || process.env.MAX_SUPPORT_CHAT_ID?.trim();
  return Boolean(token && dest);
}
