import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

import { readLegacyPublicUpload, resolveLegacyPublicUploadPath } from "@/lib/public-uploads";
import { PRIVATE_UPLOAD_URL_PREFIX, privateUploadUrl } from "@/lib/sensitive-upload-urls";

/** Подкаталоги с персональными/налоговыми документами — только через /api/private-media. */
export const PRIVATE_UPLOAD_SUBDIRS = new Set(["compliance", "npd-receipts"]);

export { PRIVATE_UPLOAD_URL_PREFIX, privateUploadUrl } from "@/lib/sensitive-upload-urls";

export function getPrivateUploadsRoot(): string {
  return path.join(process.cwd(), "private", "uploads");
}

export function resolvePrivateUploadPath(segments: string[]): string | null {
  if (!segments.length) return null;
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("\\") || s.includes("/"))) {
    return null;
  }
  if (!PRIVATE_UPLOAD_SUBDIRS.has(segments[0])) return null;

  const root = path.resolve(getPrivateUploadsRoot());
  const resolved = path.resolve(root, ...segments);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return resolved;
}

export async function writePrivateUpload(
  subdir: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const segments = [subdir, filename];
  const filepath = resolvePrivateUploadPath(segments);
  if (!filepath) throw new Error("invalid-private-upload-path");

  await mkdir(path.dirname(filepath), { recursive: true });
  await writeFile(filepath, buffer);

  return privateUploadUrl(subdir, filename);
}

export async function readPrivateUpload(segments: string[]): Promise<Buffer | null> {
  const filepath = resolvePrivateUploadPath(segments);
  if (!filepath) return null;
  try {
    await access(filepath);
    return readFile(filepath);
  } catch {
    return null;
  }
}

/** Старые URL в public/uploads — читаем для обратной совместимости. */
export async function readSensitiveUpload(segments: string[]): Promise<Buffer | null> {
  const fromPrivate = await readPrivateUpload(segments);
  if (fromPrivate) return fromPrivate;
  return readLegacyPublicUpload(segments);
}

export async function removePrivateUploadByUrl(url: string | null | undefined): Promise<void> {
  if (!url?.trim()) return;
  let segments: string[] | null = null;
  if (url.startsWith(PRIVATE_UPLOAD_URL_PREFIX)) {
    segments = url.slice(PRIVATE_UPLOAD_URL_PREFIX.length).split("/");
  } else if (url.startsWith("/uploads/")) {
    segments = url.replace(/^\/uploads\//, "").split("/");
  }
  if (!segments?.length || !PRIVATE_UPLOAD_SUBDIRS.has(segments[0])) return;

  const privatePath = resolvePrivateUploadPath(segments);
  if (privatePath) {
    try {
      await unlink(privatePath);
    } catch {
      /* already removed */
    }
  }

  const legacyPath = resolveLegacyPublicUploadPath(segments);
  if (legacyPath) {
    try {
      await unlink(legacyPath);
    } catch {
      /* already removed */
    }
  }
}
