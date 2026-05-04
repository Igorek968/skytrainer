import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

export const clientExtrasRouter = Router();

clientExtrasRouter.get("/favorites", authMiddleware, requireRole("client"), async (req: AuthedRequest, res) => {
  const q = await pool.query(
    `SELECT i.user_id AS uid, i.display_name AS "displayName", i.photo_url AS "photoUrl",
            i.hourly_rate AS "hourlyRate", i.avg_rating AS rating
     FROM favorites f
     JOIN instructors i ON i.user_id = f.instructor_user_id
     WHERE f.client_id = $1`,
    [req.userId]
  );
  res.json(q.rows);
});

const favSchema = z.object({ instructorUserId: z.string().uuid() });

clientExtrasRouter.post("/favorites", authMiddleware, requireRole("client"), async (req: AuthedRequest, res) => {
  const parsed = favSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await pool.query(
    `INSERT INTO favorites (client_id, instructor_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.userId, parsed.data.instructorUserId]
  );
  res.status(201).json({ ok: true });
});

clientExtrasRouter.delete("/favorites/:instructorUserId", authMiddleware, requireRole("client"), async (req: AuthedRequest, res) => {
  await pool.query(`DELETE FROM favorites WHERE client_id = $1 AND instructor_user_id = $2`, [
    req.userId,
    req.params.instructorUserId
  ]);
  res.json({ ok: true });
});

const pmSchema = z.object({
  provider: z.enum(["yookassa_card", "yookassa_sbp"]),
  label: z.string().min(2),
  externalId: z.string().min(4),
  isDefault: z.boolean().optional()
});

clientExtrasRouter.get("/payment-methods", authMiddleware, requireRole("client"), async (req: AuthedRequest, res) => {
  const q = await pool.query(`SELECT id, provider, label, external_id AS "externalId", is_default AS "isDefault" FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC`, [
    req.userId
  ]);
  res.json(q.rows);
});

clientExtrasRouter.post("/payment-methods", authMiddleware, requireRole("client"), async (req: AuthedRequest, res) => {
  const parsed = pmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { provider, label, externalId, isDefault } = parsed.data;
  if (isDefault) {
    await pool.query(`UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1`, [req.userId]);
  }
  const ins = await pool.query(
    `INSERT INTO payment_methods (user_id, provider, label, external_id, is_default)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [req.userId, provider, label, externalId, Boolean(isDefault)]
  );
  res.status(201).json(ins.rows[0]);
});
