import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

async function main() {
  const hash = await bcrypt.hash("Demo123!", 10);

  const clientRes = await pool.query(
    `INSERT INTO users (email, phone, password_hash, role, display_name)
     VALUES ($1, NULL, $2, 'client', $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    ["client@skytrainer.local", hash, "Клиент Демо"]
  );
  const clientId = clientRes.rows[0].id as string;

  const instUser = await pool.query(
    `INSERT INTO users (email, phone, password_hash, role, display_name)
     VALUES ($1, NULL, $2, 'instructor', $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    ["instructor@skytrainer.local", hash, "Инструктор Демо"]
  );
  const instId = instUser.rows[0].id as string;

  await pool.query(
    `INSERT INTO instructors (
       user_id, resort_slug, display_name, photo_url, experience_years, certificates,
       hourly_rate, avg_rating, rating_count, priority_penalty, location, availability, is_online, languages
     ) VALUES (
       $1, 'krasnaya', 'Инструктор Демо', 'https://i.pravatar.cc/300?img=12', 8,
       $2::jsonb, 4500, 4.85, 42, FALSE,
       ST_SetSRID(ST_MakePoint(40.202, 43.679), 4326)::geography,
       'available_now', TRUE, ARRAY['ru','en']::TEXT[]
     )
     ON CONFLICT (user_id) DO UPDATE SET
       hourly_rate = EXCLUDED.hourly_rate,
       location = EXCLUDED.location,
       availability = EXCLUDED.availability`,
    [instId, JSON.stringify(["ГТЦ РФ", "ИСИА"])]
  );

  const inst2 = await pool.query(
    `INSERT INTO users (email, phone, password_hash, role, display_name)
     VALUES ($1, NULL, $2, 'instructor', $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    ["maria@skytrainer.local", hash, "Мария Лесная"]
  );
  const inst2Id = inst2.rows[0].id as string;

  await pool.query(
    `INSERT INTO instructors (
       user_id, resort_slug, display_name, photo_url, experience_years, certificates,
       hourly_rate, avg_rating, rating_count, priority_penalty, location, availability, is_online, languages
     ) VALUES (
       $1, 'krasnaya', 'Мария Лесная', 'https://i.pravatar.cc/300?img=22', 6,
       $2::jsonb, 5200, 4.2, 31, TRUE,
       ST_SetSRID(ST_MakePoint(40.208, 43.673), 4326)::geography,
       'available_later', TRUE, ARRAY['ru']::TEXT[]
     )
     ON CONFLICT (user_id) DO UPDATE SET
       priority_penalty = EXCLUDED.priority_penalty`,
    [inst2Id, JSON.stringify(["Детский инструктор"])]
  );

  const inst3 = await pool.query(
    `INSERT INTO users (email, phone, password_hash, role, display_name)
     VALUES ($1, NULL, $2, 'instructor', $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    ["busy@skytrainer.local", hash, "Тимур Занят"]
  );
  const inst3Id = inst3.rows[0].id as string;

  await pool.query(
    `INSERT INTO instructors (
       user_id, resort_slug, display_name, photo_url, experience_years, certificates,
       hourly_rate, avg_rating, rating_count, priority_penalty, location, availability, is_online, languages
     ) VALUES (
       $1, 'sheregesh', 'Тимур Занят', 'https://i.pravatar.cc/300?img=33', 10,
       $2::jsonb, 6000, 4.95, 120, FALSE,
       ST_SetSRID(ST_MakePoint(87.985, 52.920), 4326)::geography,
       'busy', TRUE, ARRAY['ru','en']::TEXT[]
     )
     ON CONFLICT (user_id) DO NOTHING`,
    [inst3Id, JSON.stringify(["Фрирайд PRO"])]
  );

  await pool.query(
    `INSERT INTO favorites (client_id, instructor_user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [clientId, instId]
  );

  console.log("Seed OK. client@skytrainer.local / Demo123! , instructor@skytrainer.local / Demo123!");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
