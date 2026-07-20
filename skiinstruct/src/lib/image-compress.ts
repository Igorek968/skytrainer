import sharp from "sharp";

/** Макс. сторона обложки/аватара (px). */
export const IMAGE_COMPRESS_MAX_SIDE = 1600;

/** JPEG quality после сжатия. */
export const IMAGE_COMPRESS_JPEG_QUALITY = 82;

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
 * JPEG mozjpeg.
 */
export async function compressImageBuffer(input: Buffer): Promise<CompressedImage> {
  const image = sharp(input, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  let pipeline = image;
  if (width > IMAGE_COMPRESS_MAX_SIDE || height > IMAGE_COMPRESS_MAX_SIDE) {
    pipeline = pipeline.resize({
      width: IMAGE_COMPRESS_MAX_SIDE,
      height: IMAGE_COMPRESS_MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (meta.hasAlpha) {
    pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
  }

  const buffer = await pipeline
    .jpeg({ quality: IMAGE_COMPRESS_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return { buffer, mime: "image/jpeg", ext: "jpg" };
}

/**
 * Сжать загруженные байты. При ошибке или если JPEG больше исходника —
 * возвращает оригинал.
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
    if (compressed.buffer.length >= original.length && original.length > 0) {
      return fallback;
    }
    return compressed;
  } catch {
    return fallback;
  }
}
