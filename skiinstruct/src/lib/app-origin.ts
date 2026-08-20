const INTERNAL_HOSTS = new Set(["0.0.0.0", "127.0.0.1", "localhost", "[::1]"]);

function isPublicHost(hostname: string): boolean {
  return !INTERNAL_HOSTS.has(hostname.toLowerCase());
}

/** Публичный origin сайта из env (без завершающего /). */
export function configuredAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "";
  return raw.replace(/\/+$/, "");
}

/** Абсолютный URL приложения — не использует внутренний 0.0.0.0 из Docker. */
export function absoluteAppUrl(path: string, req?: Request): URL {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const configured = configuredAppOrigin();
  if (configured) {
    try {
      const host = new URL(configured).hostname;
      if (isPublicHost(host)) {
        return new URL(normalizedPath, `${configured}/`);
      }
    } catch {
      /* ignore */
    }
  }

  if (req) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    const hostHeader =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host")?.trim();
    if (hostHeader) {
      const hostname = hostHeader.split(":")[0] ?? hostHeader;
      if (isPublicHost(hostname)) {
        return new URL(normalizedPath, `${proto}://${hostHeader}`);
      }
    }

    try {
      const fromReq = new URL(req.url);
      if (isPublicHost(fromReq.hostname)) {
        return new URL(normalizedPath, fromReq.origin);
      }
    } catch {
      /* ignore */
    }
  }

  const fallback = configured || "http://твойтренер.рф";
  return new URL(normalizedPath, `${fallback}/`);
}

/** Хост сайта для push-уведомлений и подсказок (без схемы). */
export function publicSiteHostLabel(): string {
  const origin = configuredAppOrigin();
  if (origin) {
    try {
      return new URL(origin).host;
    } catch {
      /* ignore */
    }
  }
  return "твойтренер.рф";
}

const BRAND_SHARE_ORIGIN = "https://твойтренер.рф";
const BRAND_PUNY_HOSTS = new Set([
  "твойтренер.рф",
  "www.твойтренер.рф",
  "xn--b1agaovdpdkd.xn--p1ai",
  "www.xn--b1agaovdpdkd.xn--p1ai",
]);

/**
 * Origin для реферальных/шаринговых ссылок: всегда читаемое «твойтренер.рф»,
 * а не punycode xn--… (его подставляет APP_PUBLIC_URL на VPS).
 */
export function publicShareOrigin(): string {
  const configured = configuredAppOrigin();
  if (!configured) return BRAND_SHARE_ORIGIN;
  try {
    const u = new URL(configured);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return configured.replace(/\/+$/, "");
    }
    if (BRAND_PUNY_HOSTS.has(host)) {
      return BRAND_SHARE_ORIGIN;
    }
    return configured.replace(/\/+$/, "");
  } catch {
    return BRAND_SHARE_ORIGIN;
  }
}
