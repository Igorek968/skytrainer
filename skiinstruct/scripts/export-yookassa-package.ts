/**
 * Пакет документов для отправки в ЮKassa.
 *
 *   npm run export:yookassa-package
 *   npm run export:yookassa-package -- --active-only
 *   npm run export:yookassa-package -- --out ./exports/yookassa
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";

import { buildYookassaPackageFiles } from "../src/lib/yookassa-document-package";

async function main() {
  const args = process.argv.slice(2);
  const activeOnly = args.includes("--active-only");
  const noCertificates = args.includes("--no-certificates");
  const outIdx = args.indexOf("--out");
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir =
    outIdx >= 0 && args[outIdx + 1]
      ? resolve(args[outIdx + 1]!)
      : resolve(process.cwd(), `exports/yookassa-${stamp}`);

  const pkg = await buildYookassaPackageFiles({
    activeOnly,
    includeCertificates: !noCertificates,
  });

  for (const file of pkg.files) {
    const target = join(outDir, file.name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content, "utf8");
  }

  console.log(`Пакет для ЮKassa: ${outDir}`);
  console.log(`Инструкторов в реестре: ${pkg.rowCount}`);
  console.log(`Файлов: ${pkg.files.length}`);
  console.log("");
  console.log("Откройте yookassa-paket-*.html в браузере → Печать → «Сохранить как PDF».");
  console.log("CSV и справки — в той же папке.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
