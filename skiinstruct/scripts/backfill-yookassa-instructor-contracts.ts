/**
 * Выгрузка реестра + рассылка заполненных агентских договоров на почту ops.
 *
 *   npx tsx scripts/backfill-yookassa-instructor-contracts.ts
 *   npx tsx scripts/backfill-yookassa-instructor-contracts.ts --backfill-accept
 *   npx tsx scripts/backfill-yookassa-instructor-contracts.ts --notify
 *   npx tsx scripts/backfill-yookassa-instructor-contracts.ts --notify --force
 *   npx tsx scripts/backfill-yookassa-instructor-contracts.ts --out ./out/agency.csv
 *   npx tsx scripts/backfill-yookassa-instructor-contracts.ts --contracts-dir ./out/dogovory
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";

import {
  agencyRegistryToCsv,
  fetchAgencyCertificateData,
  fetchAgencyRegistryRows,
  renderAgencyCertificateHtml,
} from "../src/lib/instructor-agency-registry";
import { prisma } from "../src/lib/prisma";
import { notifyPendingYookassaInstructorContracts } from "../src/lib/services/yookassa-instructor-contract-notify";

async function main() {
  const args = process.argv.slice(2);
  const doNotify = args.includes("--notify");
  const force = args.includes("--force");
  const outIdx = args.indexOf("--out");
  const dirIdx = args.indexOf("--contracts-dir");

  if (args.includes("--backfill-accept")) {
    const legacy = await prisma.instructorProfile.findMany({
      where: { agencyOfferAcceptedAt: null },
      select: { userId: true, createdAt: true, agencyOfferVersion: true },
    });
    for (const p of legacy) {
      await prisma.instructorProfile.update({
        where: { userId: p.userId },
        data: {
          agencyOfferAcceptedAt: p.createdAt,
          agencyOfferVersion: p.agencyOfferVersion ?? "2026-05-13",
        },
      });
    }
    console.log(`Backfill акцепта оферты: ${legacy.length} профилей (дата = createdAt)`);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const outPath =
    outIdx >= 0 && args[outIdx + 1]
      ? resolve(args[outIdx + 1]!)
      : resolve(process.cwd(), `agency-registry-${stamp}.csv`);

  const rows = await fetchAgencyRegistryRows();
  writeFileSync(outPath, agencyRegistryToCsv(rows), "utf8");
  console.log(`CSV: ${rows.length} инструкторов → ${outPath}`);

  if (dirIdx >= 0 && args[dirIdx + 1]) {
    const dir = resolve(args[dirIdx + 1]!);
    mkdirSync(dir, { recursive: true });
    let n = 0;
    for (const r of rows) {
      const data = await fetchAgencyCertificateData(r.userId);
      if (!data) continue;
      const html = renderAgencyCertificateHtml(data);
      const file = join(dir, `agent-dogovor-${r.userId}.html`);
      writeFileSync(file, html, "utf8");
      n += 1;
    }
    console.log(`HTML-договоры: ${n} → ${dir}`);
  }

  if (doNotify) {
    const result = await notifyPendingYookassaInstructorContracts({ force, limit: 500 });
    console.log(
      `Notify: total=${result.total} sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`,
    );
    for (const e of result.errors) console.error(" ", e);
  } else {
    const pending = rows.filter((r) => r.agencyOfferAcceptedAt && !r.yookassaContractNotifiedAt).length;
    console.log(`На почту ещё не ушло: ${pending}. Запустите с --notify`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
