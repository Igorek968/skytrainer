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

  const fallback = configured || "https://utrainer.ru";
  return new URL(normalizedPath, `${fallback}/`);
}
