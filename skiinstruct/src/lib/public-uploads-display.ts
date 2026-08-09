import { resolveSensitiveUploadDisplaySrc } from "@/lib/sensitive-upload-urls";

/** Абсолютный URL нашего /api/media|/api/private-media|/uploads → относительный путь (для next/image и img). */
function relativizeOwnUploadUrl(absoluteUrl: string): string | null {
  try {
    const parsed = new URL(absoluteUrl);
    const path = `${parsed.pathname}${parsed.search}`;
    if (
      path.startsWith("/api/media/") ||
      path.startsWith("/api/private-media/") ||
      path.startsWith("/uploads/")
    ) {
      return path;
    }
  } catch {
    /* not a valid absolute URL */
  }
  return null;
}

/** URL для <img src> / ссылки — публичные через /api/media, чувствительные через /api/private-media. */
export function publicUploadDisplaySrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/api/private-media/") || trimmed.startsWith("/api/media/")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    const own = relativizeOwnUploadUrl(trimmed);
    if (own?.startsWith("/uploads/")) {
      return `/api/media/${own.slice("/uploads/".length)}`;
    }
    if (own) return own;
    return trimmed;
  }
  const sensitive = resolveSensitiveUploadDisplaySrc(trimmed);
  if (sensitive) return sensitive;
  if (trimmed.startsWith("/uploads/")) {
    return `/api/media/${trimmed.slice("/uploads/".length)}`;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** Display URL или абсолютная ссылка → путь хранения `/uploads/...` (для API и БД). */
export function publicUploadStorageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/uploads/")) return trimmed;
  if (trimmed.startsWith("/api/media/")) {
    return `/uploads/${trimmed.slice("/api/media/".length)}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith("/api/media/")) {
        return `/uploads/${parsed.pathname.slice("/api/media/".length)}`;
      }
    } catch {
      /* not a valid URL */
    }
    return trimmed;
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
