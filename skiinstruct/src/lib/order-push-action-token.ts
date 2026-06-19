import crypto from "crypto";

const TTL_MS = 48 * 60 * 60 * 1000;

function authSecret(): string | null {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || null;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Токен для «Принять/Отклонить» из push (service worker без сессии). */
export function createOrderPushActionToken(orderId: string, instructorId: string): string | null {
  const secret = authSecret();
  if (!secret) return null;
  const exp = Date.now() + TTL_MS;
  const payload = `${orderId}:${instructorId}:${exp}`;
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sign(payload, secret)}`;
}

export function verifyOrderPushActionToken(
  token: string,
  orderId: string,
  instructorId: string,
): boolean {
  const secret = authSecret();
  if (!secret) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = sign(payload, secret);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const parts = payload.split(":");
  if (parts.length !== 3) return false;
  const [oid, iid, expRaw] = parts;
  if (oid !== orderId || iid !== instructorId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return true;
}
