import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sqlPath = path.join(__dirname, "..", "..", "migrations", "001_init.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const migrationName = "001_init.sql";

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = await pool.query<{ name: string }>(
    `SELECT name FROM schema_migrations WHERE name = $1`,
    [migrationName]
  );

  if (applied.rowCount) {
    console.log(`Migration ${migrationName} already applied, skipping.`);
    await pool.end();
    return;
  }

  const legacyState = await pool.query<{ exists: string | null }>(
    `SELECT to_regclass('public.resorts') AS exists`
  );
  if (legacyState.rows[0]?.exists) {
    await pool.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [migrationName]);
    console.log(`Migration ${migrationName} marked as applied (schema already present).`);
    await pool.end();
    return;
  }

  await pool.query(sql);
  await pool.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [migrationName]);
  console.log(`Migration ${migrationName} applied.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
