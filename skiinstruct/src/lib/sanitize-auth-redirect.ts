const AUTH_PATH_PREFIXES = ["/login", "/register", "/admin/login", "/instructor/login"] as const;

function appOriginCandidates(): string[] {
  const out: string[] = [];
  for (const raw of [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_PUBLIC_URL,
  ]) {
    const v = raw?.trim();
    if (!v) continue;
    try {
      out.push(new URL(v).origin);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    try {
      out.push(window.location.origin);
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)];
}

/** Безопасный путь после входа (только свой origin, без open redirect на чужие домены). */
export function sanitizeRedirectPath(raw: string, fallback: string): string {
  let path = (raw || "").trim();
  if (!path) return fallback;

  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")) {
    try {
      const absolute = path.startsWith("//") ? `https:${path}` : path;
      const u = new URL(absolute);
      const allowed = appOriginCandidates();
      if (!allowed.length || !allowed.includes(u.origin)) return fallback;
      path = `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return fallback;
    }
  }

  if (!path.startsWith("/") || path.startsWith("//")) return fallback;

  const bare = path.split("?")[0]?.split("#")[0] ?? path;
  for (const p of AUTH_PATH_PREFIXES) {
    if (bare === p || bare.startsWith(`${p}/`)) return fallback;
  }

  return path || fallback;
}

/** Только относительный путь приложения (для push url и т.п.). */
export function sanitizeAppRelativeUrl(raw: string | null | undefined, fallback = "/"): string {
  return sanitizeRedirectPath(raw?.trim() || fallback, fallback);
}
