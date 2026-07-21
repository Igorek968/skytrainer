/**
 * Generates notification icons + PWA/apple icons.
 * Run: node scripts/generate-notification-icons.mjs
 *
 * - notification-icon: teal bg (push on iOS/desktop)
 * - apple-touch / icon-192 / icon-512 / maskable: white bg (iPhone home screen)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const logoSvg = path.join(publicDir, "brand/logo-mark.svg");
const teal = { r: 15, g: 118, b: 110, alpha: 1 };
const white = { r: 255, g: 255, b: 255, alpha: 1 };

async function logoContain(size) {
  return sharp(logoSvg, { density: 400 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function writeOnBg(name, size, pad, bg) {
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: await logoContain(pad), gravity: "centre" }])
    .png()
    .toFile(path.join(publicDir, name));
  console.log(`Wrote ${name}`);
}

async function main() {
  await writeOnBg("notification-icon.png", 192, 140, teal);

  const { data, info } = await sharp(logoSvg, { density: 300 })
    .resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const a = data[i * 4 + 3];
    const lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    const keep = a > 40 && lum > 18;
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = keep ? 255 : 0;
  }

  const badgeInner = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(100, 100, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: badgeInner, gravity: "centre" }])
    .png()
    .toFile(path.join(publicDir, "notification-badge.png"));
  console.log("Wrote notification-badge.png");

  // iPhone / PWA: белый фон
  await writeOnBg("apple-touch-icon.png", 180, 132, white);
  await writeOnBg("icon-192.png", 192, 140, white);
  await writeOnBg("icon-512.png", 512, 380, white);
  await writeOnBg("icon-maskable-512.png", 512, 320, white);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
