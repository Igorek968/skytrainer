const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const RIFF = [0x52, 0x49, 0x46, 0x46];

function startsWith(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

function isWebp(buf: Buffer): boolean {
  return startsWith(buf, RIFF) && buf.length >= 12 && buf.subarray(8, 12).toString("ascii") === "WEBP";
}

/** Проверка magic bytes (не доверяем Content-Type от клиента). */
export function validateUploadedBytes(declaredMime: string, buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  switch (declaredMime) {
    case "image/jpeg":
      return startsWith(buffer, JPEG);
    case "image/png":
      return startsWith(buffer, PNG);
    case "image/webp":
      return isWebp(buffer);
    case "application/pdf":
      return startsWith(buffer, PDF);
    default:
      return false;
  }
}
