import sharp from "sharp";

/** Макс. сторона обложки/аватара (px). */
export const IMAGE_COMPRESS_MAX_SIDE = 1600;

/** JPEG quality после сжатия. */
export const IMAGE_COMPRESS_JPEG_QUALITY = 82;

/** Целевой размер сжатого JPEG (байты). */
export const IMAGE_COMPRESS_TARGET_BYTES = 900 * 1024;

export type CompressedImage = {
  buffer: Buffer;
  mime: "image/jpeg";
  ext: "jpg";
};

function fallbackExt(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/**
 * Сжимает фото при загрузке: автоповорот EXIF, уменьшение длинной стороны,
 * JPEG mozjpeg. Крупный исходник не возвращаем «как есть».
 */
export async function compressImageBuffer(input: Buffer): Promise<CompressedImage> {
  const meta = await sharp(input, { failOn: "none" }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const hasAlpha = Boolean(meta.hasAlpha);
  const sides = [IMAGE_COMPRESS_MAX_SIDE, 1280, 1024, 800];
  let best: CompressedImage | null = null;

  for (const maxSide of sides) {
    let quality = IMAGE_COMPRESS_JPEG_QUALITY;
    while (quality >= 50) {
      let pipeline = sharp(input, { failOn: "none" }).rotate();
      if (width > maxSide || height > maxSide) {
        pipeline = pipeline.resize({
          width: maxSide,
          height: maxSide,
          fit: "inside",
          withoutEnlargement: true,
        });
      }
      if (hasAlpha) {
        pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
      }
      const buffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      const candidate: CompressedImage = { buffer, mime: "image/jpeg", ext: "jpg" };
      if (!best || candidate.buffer.length < best.buffer.length) best = candidate;
      if (candidate.buffer.length <= IMAGE_COMPRESS_TARGET_BYTES) return candidate;
      quality -= 8;
    }
  }

  if (!best) {
    throw new Error("compress-failed");
  }
  return best;
}

/**
 * Сжать загруженные байты. Крупный оригинал всегда заменяем JPEG,
 * даже если сжатие чуть больше исходника (типично для мелких PNG).
 */
export async function compressUploadedImageBytes(
  original: Buffer,
  sourceMime: string,
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  const fallback = {
    buffer: original,
    mime: sourceMime,
    ext: fallbackExt(sourceMime),
  };
  try {
    const compressed = await compressImageBuffer(original);
    if (original.length > IMAGE_COMPRESS_TARGET_BYTES) return compressed;
    if (compressed.buffer.length >= original.length && original.length > 0) {
      return fallback;
    }
    return compressed;
  } catch {
    return fallback;
  }
}
