/** Клиентское сжатие перед upload (быстрее сеть). Сервер всё равно пережмёт. */

const MAX_SIDE = 1600;

export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (typeof window === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const outType = "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), outType, 0.82),
    );
    if (!blob) return file;

    const compressed = new File(
      [blob],
      file.name.replace(/\.\w+$/, ".jpg"),
      { type: outType, lastModified: Date.now() },
    );
    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}
