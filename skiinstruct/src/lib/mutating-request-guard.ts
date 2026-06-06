import { NextResponse } from "next/server";

function appHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const raw of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
  ]) {
    if (!raw?.trim()) continue;
    try {
      hosts.add(new URL(raw.trim()).host.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  return hosts;
}

/**
 * Защита state-changing API от cross-site запросов (дополнение к SameSite cookies).
 * Webhooks/cron вызывайте только с исключением в middleware.
 */
export function assertMutationSameOrigin(req: Request): NextResponse | null {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const secFetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") return null;

  const origin = req.headers.get("origin")?.trim();
  const referer = req.headers.get("referer")?.trim();
  const host = req.headers.get("host")?.trim().toLowerCase();
  const allowed = appHosts();

  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (host && originHost === host) return null;
      if (allowed.has(originHost)) return null;
    } catch {
      /* invalid origin */
    }
  }

  if (referer && host) {
    try {
      const refHost = new URL(referer).host.toLowerCase();
      if (refHost === host) return null;
      if (allowed.has(refHost)) return null;
    } catch {
      /* invalid referer */
    }
  }

  // Нет Origin/Referer — допускаем только same-origin fetch (sec-fetch-site cross-site блокируется выше).
  if (!origin && !referer && secFetchSite !== "cross-site") return null;

  return NextResponse.json({ error: "Запрос отклонён (origin)" }, { status: 403 });
}
