/**
 * Генерирует PNG-иконки для PWA и Google Play TWA из public/icon.svg и icon-maskable.svg.
 * Запуск: npm run pwa:icons
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");

const sources = [
  { input: "icon.svg", output: "icon-192.png", size: 192 },
  { input: "icon.svg", output: "icon-512.png", size: 512 },
  { input: "icon-maskable.svg", output: "icon-maskable-512.png", size: 512 },
  { input: "icon.svg", output: "apple-touch-icon.png", size: 180 },
];

for (const { input, output, size } of sources) {
  const inputPath = path.join(publicDir, input);
  const outputPath = path.join(publicDir, output);
  if (!fs.existsSync(inputPath)) {
    console.error(`Missing ${inputPath}`);
    process.exit(1);
  }
  await sharp(inputPath).resize(size, size).png().toFile(outputPath);
  console.log(`Wrote ${output} (${size}x${size})`);
}
