/** URL для <img src> — через API, чтобы файлы отдавались и в Docker/prod. */
export function publicUploadDisplaySrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/api/media/")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/uploads/")) {
    return `/api/media/${trimmed.slice("/uploads/".length)}`;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function resolveAppOrigin(origin?: string): string {
  const fromArg = origin?.trim().replace(/\/$/, "");
  if (fromArg) return fromArg;
  if (typeof window !== "undefined") return window.location.origin;
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    process.env.AUTH_URL?.trim().replace(/\/$/, "");
  return fromEnv ?? "";
}

/** Абсолютный URL — для Яндекс.Карт и внешних виджетов (относительный /api/media ломается). */
export function publicUploadAbsoluteDisplaySrc(
  url: string | null | undefined,
  origin?: string,
): string | null {
  const src = publicUploadDisplaySrc(url);
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  const base = resolveAppOrigin(origin);
  if (!base) return src;
  return `${base}${src.startsWith("/") ? src : `/${src}`}`;
}

export function publicUploadDisplaySrcs(urls: string[] | null | undefined): string[] {
  if (!urls?.length) return [];
  return urls
    .map((url) => publicUploadDisplaySrc(url))
    .filter((url): url is string => Boolean(url));
}
