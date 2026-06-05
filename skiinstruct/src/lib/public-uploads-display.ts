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

export function publicUploadDisplaySrcs(urls: string[] | null | undefined): string[] {
  if (!urls?.length) return [];
  return urls
    .map((url) => publicUploadDisplaySrc(url))
    .filter((url): url is string => Boolean(url));
}
