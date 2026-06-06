import { access, mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";

/** Публичные подкаталоги (без персональных документов — те в private/uploads). */
export const PUBLIC_UPLOAD_SUBDIRS = new Set(["events", "instructors", "users"]);

/** Устаревшие пути — только чтение для миграции; новые загрузки в private/. */
export const LEGACY_SENSITIVE_PUBLIC_SUBDIRS = new Set(["compliance", "npd-receipts"]);

export function getPublicUploadsRoot(): string {
  return path.join(process.cwd(), "public", "uploads");
}

/** Безопасный абсолютный путь к файлу в public/uploads (или null). */
export function resolvePublicUploadPath(segments: string[]): string | null {
  if (!segments.length) return null;
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("\\") || s.includes("/"))) {
    return null;
  }
  if (!PUBLIC_UPLOAD_SUBDIRS.has(segments[0])) return null;

  const root = path.resolve(getPublicUploadsRoot());
  const resolved = path.resolve(root, ...segments);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return resolved;
}

export function publicUploadUrl(segments: string[]): string {
  return `/uploads/${segments.join("/")}`;
}

export async function writePublicUpload(
  subdir: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const segments = [subdir, filename];
  const filepath = resolvePublicUploadPath(segments);
  if (!filepath) throw new Error("invalid-upload-path");

  await mkdir(path.dirname(filepath), { recursive: true });
  await writeFile(filepath, buffer);
  const st = await stat(filepath);
  if (st.size < 1) throw new Error("upload-empty");

  return publicUploadUrl(segments);
}

export async function removePublicUploadByUrl(url: string | null | undefined): Promise<void> {
  if (!url?.startsWith("/uploads/")) return;
  const segments = url.replace(/^\/uploads\//, "").split("/");
  const filepath = resolvePublicUploadPath(segments);
  if (!filepath) return;
  try {
    await unlink(filepath);
  } catch {
    /* already removed */
  }
}

/** Только чтение старых файлов в public/uploads/compliance|npd-receipts. */
export function resolveLegacyPublicUploadPath(segments: string[]): string | null {
  if (!segments.length) return null;
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("\\") || s.includes("/"))) {
    return null;
  }
  if (!LEGACY_SENSITIVE_PUBLIC_SUBDIRS.has(segments[0])) return null;

  const root = path.resolve(getPublicUploadsRoot());
  const resolved = path.resolve(root, ...segments);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return resolved;
}

export async function readPublicUpload(segments: string[]): Promise<Buffer | null> {
  const filepath = resolvePublicUploadPath(segments);
  if (!filepath) return null;
  try {
    await access(filepath);
    return readFile(filepath);
  } catch {
    return null;
  }
}

export async function readLegacyPublicUpload(segments: string[]): Promise<Buffer | null> {
  const filepath = resolveLegacyPublicUploadPath(segments);
  if (!filepath) return null;
  try {
    await access(filepath);
    return readFile(filepath);
  } catch {
    return null;
  }
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export function mimeForUploadPath(filepath: string): string {
  const ext = path.extname(filepath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
