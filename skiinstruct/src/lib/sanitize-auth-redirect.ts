const AUTH_PATH_PREFIXES = ["/login", "/register", "/admin/login", "/instructor/login"] as const;

/** Безопасный путь после входа (только свой origin, без open redirect на чужие домены). */
export function sanitizeRedirectPath(raw: string, fallback: string): string {
  let path = (raw || "").trim();
  if (!path) return fallback;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const u = new URL(path);
      const baseRaw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
      if (!baseRaw) return fallback;
      const base = new URL(baseRaw);
      if (u.origin !== base.origin) return fallback;
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
