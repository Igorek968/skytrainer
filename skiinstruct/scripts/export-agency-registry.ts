/**
 * Выгрузка реестра акцептов агентского договора в CSV.
 *
 *   npx tsx scripts/export-agency-registry.ts
 *   npx tsx scripts/export-agency-registry.ts --active-only
 *   npx tsx scripts/export-agency-registry.ts --out ./agency-registry.csv
 */
import { writeFileSync } from "fs";
import { resolve } from "path";

import { agencyRegistryToCsv, fetchAgencyRegistryRows } from "../src/lib/instructor-agency-registry";

async function main() {
  const args = process.argv.slice(2);
  const activeOnly = args.includes("--active-only");
  const outIdx = args.indexOf("--out");
  const outPath =
    outIdx >= 0 && args[outIdx + 1]
      ? resolve(args[outIdx + 1]!)
      : resolve(process.cwd(), `agency-registry-${new Date().toISOString().slice(0, 10)}.csv`);

  const rows = await fetchAgencyRegistryRows({ activeOnly });
  const csv = agencyRegistryToCsv(rows);
  writeFileSync(outPath, csv, "utf8");

  console.log(`Записано ${rows.length} инструкторов → ${outPath}`);
  const active = rows.filter((r) => r.canAcceptPaidOrders).length;
  console.log(`С полным допуском: ${active}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
