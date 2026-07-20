import crypto from "crypto";

const TTL_MS = 48 * 60 * 60 * 1000;
const SNOOZE_TTL_MS = 2 * 60 * 60 * 1000;

function authSecret(): string | null {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || null;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function pack(payload: string, secret: string): string {
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sign(payload, secret)}`;
}

function unpack(token: string, secret: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(payload, secret);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return payload;
}

/** Токен для ответа в чат поддержки из push (без сессии в SW). */
export function createSupportPushReplyToken(ticketId: string, userId: string): string | null {
  const secret = authSecret();
  if (!secret) return null;
  const exp = Date.now() + TTL_MS;
  return pack(`support-reply:${ticketId}:${userId}:${exp}`, secret);
}

export function verifySupportPushReplyToken(
  token: string,
  ticketId: string,
  userId: string,
): boolean {
  const secret = authSecret();
  if (!secret) return false;
  const payload = unpack(token, secret);
  if (!payload) return false;
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "support-reply") return false;
  const [, tid, uid, expRaw] = parts;
  if (tid !== ticketId || uid !== userId) return false;
  const exp = Number(expRaw);
  return Number.isFinite(exp) && exp >= Date.now();
}

export type PushSnoozePayload = {
  userId: string;
  title: string;
  body: string;
  url: string;
  tag: string;
};

/** Токен «отложить» — SW шлёт на API без cookie-сессии. */
export function createPushSnoozeToken(payload: PushSnoozePayload): string | null {
  const secret = authSecret();
  if (!secret) return null;
  const exp = Date.now() + SNOOZE_TTL_MS;
  const data = JSON.stringify({ ...payload, exp });
  return pack(`snooze:${data}`, secret);
}

export function verifyPushSnoozeToken(token: string): PushSnoozePayload | null {
  const secret = authSecret();
  if (!secret) return null;
  const payload = unpack(token, secret);
  if (!payload || !payload.startsWith("snooze:")) return null;
  try {
    const data = JSON.parse(payload.slice("snooze:".length)) as PushSnoozePayload & { exp?: number };
    if (!data.userId || !data.title || !data.tag) return null;
    if (!Number.isFinite(data.exp) || (data.exp ?? 0) < Date.now()) return null;
    return {
      userId: data.userId,
      title: String(data.title).slice(0, 80),
      body: String(data.body ?? "").slice(0, 200),
      url: String(data.url ?? "/").slice(0, 500),
      tag: String(data.tag).slice(0, 120),
    };
  } catch {
    return null;
  }
}
