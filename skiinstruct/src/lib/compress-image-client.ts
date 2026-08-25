/** Клиентское сжатие перед upload (быстрее сеть). Сервер всё равно пережмёт. */

/** Длинная сторона после сжатия, px. */
export const IMAGE_UPLOAD_MAX_SIDE_PX = 1600;

/** Целевой размер файла после сжатия. */
export const IMAGE_UPLOAD_TARGET_BYTES = 900 * 1024;

/** Жёсткий лимит, который принимает сервер. */
export const IMAGE_UPLOAD_HARD_MAX_BYTES = 5 * 1024 * 1024;

export const IMAGE_UPLOAD_HINT =
  "JPG, PNG или WEBP. Лучше 1200–1600 px по длинной стороне (квадрат от 800 px тоже подходит). Сайт сам сожмёт фото примерно до 1 МБ. Исходник — не больше 5 МБ.";

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
}

async function fileToBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fallback below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawScaled(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Уменьшает фото до лимита загрузки. Большой исходник с телефона не отправляем как есть.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && file.type !== "") return file;
  if (typeof window === "undefined") return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await fileToBitmap(file);
    const sides = [IMAGE_UPLOAD_MAX_SIDE_PX, 1280, 1024, 800];
    const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
    let best: File | null = null;

    for (const maxSide of sides) {
      const canvas = drawScaled(bitmap, maxSide);
      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, quality);
        if (!blob) continue;
        const next = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        if (!best || next.size < best.size) best = next;
        if (next.size <= IMAGE_UPLOAD_TARGET_BYTES) return next;
      }
    }

    if (best && best.size <= IMAGE_UPLOAD_HARD_MAX_BYTES) return best;
    if (best && file.size > IMAGE_UPLOAD_HARD_MAX_BYTES) return best;
    if (file.size <= IMAGE_UPLOAD_HARD_MAX_BYTES && (!best || best.size >= file.size)) {
      return file;
    }
    if (best) return best;
  } catch {
    /* fall through */
  } finally {
    bitmap?.close();
  }

  if (file.size > IMAGE_UPLOAD_HARD_MAX_BYTES) {
    throw new Error("Фото слишком тяжёлое. Выберите JPG/PNG меньше 5 МБ — сайт сожмёт его сам.");
  }
  return file;
}
