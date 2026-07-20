/**
 * Generates notification-icon.png, notification-badge.png, refreshes apple-touch-icon.png
 * from brand/logo-mark.png. Run: node scripts/generate-notification-icons.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const logoPath = path.join(publicDir, "brand/logo-mark.png");
const teal = { r: 15, g: 118, b: 110, alpha: 1 };

async function logoContain(size) {
  return sharp(logoPath)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  await sharp({
    create: { width: 192, height: 192, channels: 4, background: teal },
  })
    .composite([{ input: await logoContain(140), gravity: "centre" }])
    .png()
    .toFile(path.join(publicDir, "notification-icon.png"));
  console.log("Wrote notification-icon.png");

  const { data, info } = await sharp(logoPath)
    .resize(80, 80, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const a = data[i * 4 + 3];
    const lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    const keep = a > 30 && lum > 25;
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = keep ? 255 : 0;
  }

  const badgeInner = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: badgeInner, gravity: "centre" }])
    .png()
    .toFile(path.join(publicDir, "notification-badge.png"));
  console.log("Wrote notification-badge.png");

  await sharp({
    create: { width: 180, height: 180, channels: 4, background: teal },
  })
    .composite([{ input: await logoContain(132), gravity: "centre" }])
    .png()
    .toFile(path.join(publicDir, "apple-touch-icon.png"));
  console.log("Wrote apple-touch-icon.png");

  // PWA icons without white square bg (fixes tiny monochrome square in Android header)
  for (const [name, size, pad] of [
    ["icon-192.png", 192, 140],
    ["icon-512.png", 512, 380],
  ]) {
    await sharp({
      create: { width: size, height: size, channels: 4, background: teal },
    })
      .composite([{ input: await logoContain(pad), gravity: "centre" }])
      .png()
      .toFile(path.join(publicDir, name));
    console.log(`Wrote ${name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
