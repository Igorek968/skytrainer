/**
 * Единый источник логотипа: brand/press/logo-mark-on-white.png
 * (два профиля + белая дорожка на белом фоне — как на сайте).
 *
 * Run: node scripts/generate-notification-icons.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const LOGO_WHITE = path.join(publicDir, "brand/press/logo-mark-on-white.png");
const LOGO_TRANSPARENT = path.join(publicDir, "brand/press/logo-mark-transparent.png");
const white = { r: 255, g: 255, b: 255, alpha: 1 };

async function onBg(outName, size, padRatio, bg = white) {
  const pad = Math.round(size * padRatio);
  const logo = await sharp(LOGO_WHITE)
    .resize(pad, pad, { fit: "contain", background: bg })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(publicDir, outName));
  console.log(`Wrote ${outName}`);
}

async function main() {
  await onBg("apple-touch-icon.png", 180, 0.78);
  await onBg("icon-192.png", 192, 0.78);
  await onBg("icon-512.png", 512, 0.78);
  await onBg("icon-maskable-512.png", 512, 0.62);
  await onBg("favicon-120.png", 120, 0.85);
  await onBg("favicon-48.png", 48, 0.85);
  await onBg("favicon-32.png", 32, 0.9);
  await onBg("notification-icon.png", 192, 0.78);

  await sharp(path.join(publicDir, "favicon-32.png")).toFile(path.join(publicDir, "favicon.ico"));
  console.log("Wrote favicon.ico");

  // Шапка сайта — прозрачный фон
  await sharp(LOGO_TRANSPARENT)
    .resize(240, null, { fit: "inside" })
    .png()
    .toFile(path.join(publicDir, "brand/logo-mark.png"));
  console.log("Wrote brand/logo-mark.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
