import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { randomUUID } from "node:crypto";
import { sendFcmToUser } from "../services/notifications.js";

export const bookingRouter = Router();

const createSchema = z.object({
  instructorUserId: z.string().uuid(),
  resortSlug: z.enum(["krasnaya", "sheregesh", "dombay"]),
  startAt: z.string().datetime(),
  hours: z.number().int().min(1).max(8)
});

bookingRouter.post("/", authMiddleware, async (req: AuthedRequest, res) => {
  if (req.userRole !== "client") {
    res.status(403).json({ error: "Только клиент" });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { instructorUserId, resortSlug, startAt, hours } = parsed.data;
  const start = new Date(startAt);
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

  const rateQ = await pool.query<{ hourly_rate: number }>(
    `SELECT hourly_rate FROM instructors WHERE user_id = $1 AND resort_slug = $2`,
    [instructorUserId, resortSlug]
  );
  const rateRow = rateQ.rows[0];
  if (!rateRow) {
    res.status(400).json({ error: "Инструктор не найден на этом курорте" });
    return;
  }

  const totalRub = rateRow.hourly_rate * hours;
  const totalKopeks = totalRub * 100;
  const platformFeeKopeks = Math.round(totalKopeks * 0.15);
  const instructorKopeks = totalKopeks - platformFeeKopeks;

  const overlap = await pool.query(
    `SELECT 1 FROM bookings b
     WHERE b.instructor_user_id = $1
       AND b.status IN ('paid', 'confirmed', 'active')
       AND tstzrange(b.start_at, b.end_at, '[]')
           && tstzrange($2::timestamptz, $3::timestamptz, '[]')
     LIMIT 1`,
    [instructorUserId, start.toISOString(), end.toISOString()]
  );
  if (overlap.rows.length) {
    res.status(409).json({ error: "Слот занят" });
    return;
  }

  const ins = await pool.query(
    `INSERT INTO bookings (
       client_id, instructor_user_id, resort_slug, start_at, end_at, hours, status,
       total_amount_kopeks, platform_fee_kopeks, instructor_amount_kopeks
     ) VALUES ($1,$2,$3,$4,$5,$6,'pending_payment',$7,$8,$9)
     RETURNING id, start_at, end_at, hours, total_amount_kopeks, platform_fee_kopeks, instructor_amount_kopeks, status`,
    [
      req.userId,
      instructorUserId,
      resortSlug,
      start.toISOString(),
      end.toISOString(),
      hours,
      totalKopeks,
      platformFeeKopeks,
      instructorKopeks
    ]
  );

  res.status(201).json(ins.rows[0]);
});

bookingRouter.get("/mine", authMiddleware, async (req: AuthedRequest, res) => {
  if (req.userRole === "client") {
    const q = await pool.query(
      `SELECT b.*, u.display_name AS instructor_name
       FROM bookings b
       JOIN users u ON u.id = b.instructor_user_id
       WHERE b.client_id = $1 ORDER BY b.start_at DESC`,
      [req.userId]
    );
    res.json(q.rows);
    return;
  }
  const q = await pool.query(
    `SELECT b.*, u.display_name AS client_name
     FROM bookings b
     JOIN users u ON u.id = b.client_id
     WHERE b.instructor_user_id = $1 ORDER BY b.start_at DESC`,
    [req.userId]
  );
  res.json(q.rows);
});

bookingRouter.patch("/:id/confirm", authMiddleware, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const q = await pool.query(
    `UPDATE bookings SET status = 'confirmed', updated_at = now()
     WHERE id = $1 AND instructor_user_id = $2 AND status = 'paid'
     RETURNING id`,
    [id, req.userId]
  );
  if (!q.rows.length) {
    res.status(400).json({ error: "Нельзя подтвердить" });
    return;
  }
  res.json({ ok: true });
});

bookingRouter.patch("/:id/cancel", authMiddleware, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const b = await pool.query(`SELECT client_id, instructor_user_id, status FROM bookings WHERE id = $1`, [id]);
  const row = b.rows[0];
  if (!row) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }
  const allowed =
    (req.userRole === "client" && row.client_id === req.userId && ["pending_payment", "paid"].includes(row.status)) ||
    (req.userRole === "instructor" && row.instructor_user_id === req.userId && row.status !== "completed");
  if (!allowed) {
    res.status(403).json({ error: "Нельзя отменить" });
    return;
  }
  await pool.query(`UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = $1`, [id]);
  res.json({ ok: true });
});

bookingRouter.patch("/:id/start", authMiddleware, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const q = await pool.query(
    `UPDATE bookings SET status = 'active', updated_at = now()
     WHERE id = $1 AND instructor_user_id = $2 AND status IN ('paid','confirmed')
     RETURNING client_id`,
    [id, req.userId]
  );
  if (!q.rows.length) {
    res.status(400).json({ error: "Нельзя начать" });
    return;
  }
  await sendFcmToUser(q.rows[0].client_id as string, "Занятие началось", "Инструктор запустил трекинг", {
    bookingId: id,
    type: "lesson_started"
  });
  res.json({ ok: true });
});

bookingRouter.patch("/:id/complete", authMiddleware, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const q = await pool.query(
    `UPDATE bookings SET status = 'completed', updated_at = now()
     WHERE id = $1 AND instructor_user_id = $2 AND status = 'active'
     RETURNING client_id, instructor_amount_kopeks`,
    [id, req.userId]
  );
  if (!q.rows.length) {
    res.status(400).json({ error: "Нельзя завершить" });
    return;
  }
  const clientId = q.rows[0].client_id as string;
  const kop = Number(q.rows[0].instructor_amount_kopeks);
  await sendFcmToUser(clientId, "Занятие завершено", `Гонорар инструктору ${(kop / 100).toFixed(0)} ₽ (после комиссии)`, {
    bookingId: id,
    type: "lesson_completed"
  });
  await sendFcmToUser(req.userId!, "Выплата", `Зачислено ${(kop / 100).toFixed(0)} ₽ на ваш счёт (ЮKassa split)`, {
    bookingId: id,
    type: "payout_info"
  });
  res.json({ ok: true });
});

export async function markBookingPaid(bookingId: string, yooPaymentId: string): Promise<{ qr: string; instructorId: string; clientId: string } | null> {
  const qr = randomUUID();
  const q = await pool.query(
    `UPDATE bookings SET status = 'paid', yookassa_payment_id = $2, qr_payload = $3, updated_at = now()
     WHERE id = $1 AND status = 'pending_payment'
     RETURNING instructor_user_id, client_id`,
    [bookingId, yooPaymentId, qr]
  );
  const row = q.rows[0];
  if (!row) return null;
  const instructorId = row.instructor_user_id as string;
  const clientId = row.client_id as string;
  await sendFcmToUser(instructorId, "Новая бронь оплачена", `Клиент оплатил занятие ${bookingId.slice(0, 8)}`, {
    bookingId,
    type: "booking_paid"
  });
  await sendFcmToUser(clientId, "Оплата прошла", "Покажите QR-код инструктору перед стартом", {
    bookingId,
    qr,
    type: "payment_ok"
  });
  return { qr, instructorId, clientId };
}
