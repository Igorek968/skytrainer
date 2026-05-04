import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { redis } from "../services/redis.js";

export const reviewsRouter = Router();

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  text: z.string().max(4000).optional()
});

reviewsRouter.post("/", authMiddleware, async (req: AuthedRequest, res) => {
  if (req.userRole !== "client") {
    res.status(403).json({ error: "Только клиент" });
    return;
  }
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { bookingId, stars, text } = parsed.data;

  const b = await pool.query(
    `SELECT id, client_id, instructor_user_id, status FROM bookings WHERE id = $1`,
    [bookingId]
  );
  const row = b.rows[0];
  if (!row || row.client_id !== req.userId || row.status !== "completed") {
    res.status(400).json({ error: "Бронь недоступна для отзыва" });
    return;
  }

  const insId = row.instructor_user_id as string;

  const insRev = await pool.query(
    `INSERT INTO reviews (booking_id, client_id, instructor_user_id, stars, body)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (booking_id) DO NOTHING
     RETURNING id`,
    [bookingId, req.userId, insId, stars, text ?? ""]
  );
  if (!insRev.rows.length) {
    res.json({ ok: true, duplicate: true });
    return;
  }

  const agg = await pool.query<{ avg: string; cnt: string }>(
    `SELECT ROUND(AVG(stars)::numeric, 2)::text AS avg, COUNT(*)::text AS cnt
     FROM reviews WHERE instructor_user_id = $1`,
    [insId]
  );
  const avg = Number(agg.rows[0]?.avg ?? 5);
  const cnt = Number(agg.rows[0]?.cnt ?? 0);

  await pool.query(
    `UPDATE instructors SET avg_rating = $2, rating_count = $3, priority_penalty = $4 WHERE user_id = $1`,
    [insId, avg, cnt, avg < 4]
  );

  const keys = await redis.keys("ins:v3:*");
  if (keys.length) await redis.del(...keys);

  res.status(201).json({ ok: true, instructorAvgRating: avg, priorityPenalty: avg < 4 });
});
