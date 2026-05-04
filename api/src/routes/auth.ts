import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(8),
  role: z.enum(["client", "instructor"]),
  displayName: z.string().min(2)
}).refine((d) => d.email || d.phone, "Нужен email или телефон");

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, phone, password, role, displayName } = parsed.data;
  const password_hash = await hashPassword(password);
  try {
    const q = await pool.query(
      `INSERT INTO users (email, phone, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role`,
      [email ?? null, phone ?? null, password_hash, role, displayName]
    );
    const row = q.rows[0];
    if (role === "instructor") {
      await pool.query(
        `INSERT INTO instructors (
           user_id, resort_slug, display_name, photo_url, experience_years, certificates,
           hourly_rate, location, availability, is_online, languages
         ) VALUES (
           $1, 'krasnaya', $2, '', 1, '[]'::jsonb, 3000,
           ST_SetSRID(ST_MakePoint(40.205, 43.677), 4326)::geography,
           'available_later', FALSE, ARRAY['ru']::TEXT[]
         )`,
        [row.id, displayName]
      );
    }
    const token = signToken({ sub: row.id, role: row.role });
    res.status(201).json({ token, userId: row.id, role: row.role });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      res.status(409).json({ error: "Email или телефон уже заняты" });
      return;
    }
    throw e;
  }
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string()
}).refine((d) => d.email || d.phone, "Нужен email или телефон");

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, phone, password } = parsed.data;
  const q = email
    ? await pool.query(`SELECT id, password_hash, role FROM users WHERE email = $1`, [email])
    : await pool.query(`SELECT id, password_hash, role FROM users WHERE phone = $1`, [phone]);
  const row = q.rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    res.status(401).json({ error: "Неверные учётные данные" });
    return;
  }
  const token = signToken({ sub: row.id, role: row.role });
  res.json({ token, userId: row.id, role: row.role });
});

router.get("/me", authMiddleware, async (req: AuthedRequest, res) => {
  const q = await pool.query(
    `SELECT id, email, phone, role, display_name, fcm_token FROM users WHERE id = $1`,
    [req.userId]
  );
  const u = q.rows[0];
  if (!u) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(u);
});

const fcmSchema = z.object({ token: z.string().min(10) });

router.patch("/me/fcm", authMiddleware, async (req: AuthedRequest, res) => {
  const parsed = fcmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await pool.query(`UPDATE users SET fcm_token = $2 WHERE id = $1`, [req.userId, parsed.data.token]);
  res.json({ ok: true });
});

export const authRouter = router;
