import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { redis } from "../services/redis.js";

export const instructorPanelRouter = Router();

const patchSchema = z.object({
  hourlyRate: z.number().int().min(500).max(50000).optional(),
  availability: z.enum(["available_now", "available_later", "busy"]).optional(),
  isOnline: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  displayName: z.string().min(2).optional(),
  photoUrl: z.string().url().optional(),
  certificates: z.array(z.string()).optional(),
  experienceYears: z.number().int().min(0).optional(),
  languages: z.array(z.enum(["ru", "en"])).optional(),
  resortSlug: z.enum(["krasnaya", "sheregesh", "dombay"]).optional()
});

async function bustInstructorCache(): Promise<void> {
  const keys = await redis.keys("ins:v3:*");
  if (keys.length) await redis.del(...keys);
}

instructorPanelRouter.patch("/profile", authMiddleware, requireRole("instructor"), async (req: AuthedRequest, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const uid = req.userId!;

  if (d.displayName !== undefined) {
    await pool.query(`UPDATE users SET display_name = $1 WHERE id = $2`, [d.displayName, uid]);
  }

  const parts: string[] = [];
  const vals: unknown[] = [];
  let n = 1;

  if (d.hourlyRate !== undefined) {
    parts.push(`hourly_rate = $${n++}`);
    vals.push(d.hourlyRate);
  }
  if (d.availability !== undefined) {
    parts.push(`availability = $${n++}`);
    vals.push(d.availability);
  }
  if (d.isOnline !== undefined) {
    parts.push(`is_online = $${n++}`);
    vals.push(d.isOnline);
  }
  if (d.photoUrl !== undefined) {
    parts.push(`photo_url = $${n++}`);
    vals.push(d.photoUrl);
  }
  if (d.certificates !== undefined) {
    parts.push(`certificates = $${n++}::jsonb`);
    vals.push(JSON.stringify(d.certificates));
  }
  if (d.experienceYears !== undefined) {
    parts.push(`experience_years = $${n++}`);
    vals.push(d.experienceYears);
  }
  if (d.languages !== undefined) {
    parts.push(`languages = $${n++}`);
    vals.push(d.languages);
  }
  if (d.resortSlug !== undefined) {
    parts.push(`resort_slug = $${n++}`);
    vals.push(d.resortSlug);
  }
  if (d.latitude !== undefined && d.longitude !== undefined) {
    parts.push(`location = ST_SetSRID(ST_MakePoint($${n}, $${n + 1}), 4326)::geography`);
    vals.push(d.longitude, d.latitude);
    n += 2;
  }

  if (d.displayName !== undefined) {
    parts.push(`display_name = $${n++}`);
    vals.push(d.displayName);
  }

  if (parts.length) {
    vals.push(uid);
    await pool.query(`UPDATE instructors SET ${parts.join(", ")} WHERE user_id = $${n}`, vals);
    await bustInstructorCache();
  }

  res.json({ ok: true });
});

instructorPanelRouter.get("/profile", authMiddleware, requireRole("instructor"), async (req: AuthedRequest, res) => {
  const q = await pool.query(
    `SELECT i.*, ST_Y(i.location::geometry) AS lat, ST_X(i.location::geometry) AS lng
     FROM instructors i WHERE user_id = $1`,
    [req.userId]
  );
  res.json(q.rows[0] ?? null);
});
