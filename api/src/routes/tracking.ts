import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { redis } from "../services/redis.js";

export const trackingRouter = Router();

const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().optional(),
  altitude: z.number().optional(),
  recordedAt: z.string().datetime().optional()
});

trackingRouter.post("/:bookingId", authMiddleware, async (req: AuthedRequest, res) => {
  const bookingId = req.params.bookingId;
  const parsed = pointSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const access = await pool.query(
    `SELECT client_id, instructor_user_id, status FROM bookings WHERE id = $1`,
    [bookingId]
  );
  const b = access.rows[0];
  if (!b || b.status !== "active") {
    res.status(400).json({ error: "Трекинг недоступен" });
    return;
  }
  const uid = req.userId!;
  if (uid !== b.client_id && uid !== b.instructor_user_id) {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }

  const throttleKey = `trk:throttle:${bookingId}:${uid}`;
  const ok = await redis.set(throttleKey, "1", "EX", 10, "NX");
  if (!ok) {
    res.status(429).json({ error: "Не чаще раз в 10 секунд" });
    return;
  }

  const { latitude, longitude, speed, altitude } = parsed.data;
  const recordedAt = parsed.data.recordedAt ?? new Date().toISOString();

  await pool.query(
    `INSERT INTO track_points (booking_id, user_id, recorded_at, latitude, longitude, speed, altitude, geom)
     VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7, ST_SetSRID(ST_MakePoint($5,$4),4326)::geography)`,
    [bookingId, uid, recordedAt, latitude, longitude, speed ?? null, altitude ?? null]
  );

  res.json({ ok: true });
});

trackingRouter.get("/:bookingId/latest", authMiddleware, async (req: AuthedRequest, res) => {
  const bookingId = req.params.bookingId;
  const access = await pool.query(
    `SELECT client_id, instructor_user_id FROM bookings WHERE id = $1 AND status = 'active'`,
    [bookingId]
  );
  const b = access.rows[0];
  if (!b) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }
  const uid = req.userId!;
  if (uid !== b.client_id && uid !== b.instructor_user_id) {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }

  const q = await pool.query(
    `SELECT DISTINCT ON (user_id)
       user_id AS "userId",
       latitude,
       longitude,
       speed,
       altitude,
       recorded_at AS "recordedAt"
     FROM track_points
     WHERE booking_id = $1
     ORDER BY user_id, recorded_at DESC`,
    [bookingId]
  );
  res.json(q.rows);
});
