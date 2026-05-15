type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX = 100;

/**
 * Simple in-memory rate limiter (per server instance). For production at scale, use Redis.
 */
export function rateLimit(key: string, max: number = MAX, windowMs: number = WINDOW_MS): boolean {
  const now = Date.now();
  const b = store.get(key);
  if (!b || now > b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}
