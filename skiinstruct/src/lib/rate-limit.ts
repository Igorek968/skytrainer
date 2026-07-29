type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
let opsSinceCleanup = 0;

const WINDOW_MS = 60_000;
const MAX = 100;
const CLEANUP_EVERY_OPS = 500;

function cleanupExpired(now: number): void {
  for (const [key, bucket] of store.entries()) {
    if (now > bucket.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Simple in-memory rate limiter (per server instance).
 * Для нескольких инстансов задайте REDIS_URL (см. tryRedisRateLimit в будущем) или sticky sessions.
 */
export function rateLimit(key: string, max: number = MAX, windowMs: number = WINDOW_MS): boolean {
  const now = Date.now();
  opsSinceCleanup += 1;
  if (opsSinceCleanup >= CLEANUP_EVERY_OPS) {
    cleanupExpired(now);
    opsSinceCleanup = 0;
  }
  const b = store.get(key);
  if (!b || now > b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

function firstTrustedIp(forwarded: string | null): string | null {
  if (!forwarded) return null;
  const trusted = process.env.TRUSTED_PROXY_COUNT?.trim();
  const count = trusted ? Math.max(1, parseInt(trusted, 10) || 1) : 1;
  const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const idx = Math.max(0, parts.length - count);
  return parts[idx] ?? parts[0] ?? null;
}

/** IP клиента: X-Forwarded-For учитывается только при TRUSTED_PROXY_COUNT (reverse proxy). */
export function clientIp(h: Headers): string {
  const direct = h.get("x-real-ip")?.trim();
  if (direct) return direct;
  const fromForwarded = firstTrustedIp(h.get("x-forwarded-for"));
  if (fromForwarded) return fromForwarded;
  return "unknown";
}
