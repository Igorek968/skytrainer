/** URL-префиксы чувствительных файлов (без Node fs — безопасно для client components). */

export const PRIVATE_UPLOAD_URL_PREFIX = "/private/";

export function isPrivateUploadUrl(url: string | null | undefined): boolean {
  const t = url?.trim();
  return Boolean(t?.startsWith(PRIVATE_UPLOAD_URL_PREFIX));
}

export function isLegacySensitivePublicUrl(url: string | null | undefined): boolean {
  const t = url?.trim();
  if (!t) return false;
  return t.startsWith("/uploads/compliance/") || t.startsWith("/uploads/npd-receipts/");
}

export function privateMediaApiPath(relativePath: string): string {
  return `/api/private-media/${relativePath}`;
}

export function privateUploadUrl(subdir: string, filename: string): string {
  return `${PRIVATE_UPLOAD_URL_PREFIX}${subdir}/${filename}`;
}

export function resolveSensitiveUploadDisplaySrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/api/private-media/")) return trimmed;
  if (isPrivateUploadUrl(trimmed)) {
    return privateMediaApiPath(trimmed.slice(PRIVATE_UPLOAD_URL_PREFIX.length));
  }
  if (isLegacySensitivePublicUrl(trimmed)) {
    return privateMediaApiPath(trimmed.slice("/uploads/".length));
  }
  return null;
}
