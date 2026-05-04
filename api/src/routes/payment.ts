import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { createYooPayment } from "../services/yookassa.js";
import { markBookingPaid } from "./booking.js";

export const paymentRouter = Router();

const createSchema = z.object({ bookingId: z.string().uuid() });

paymentRouter.post("/create", authMiddleware, async (req: AuthedRequest, res) => {
  if (req.userRole !== "client") {
    res.status(403).json({ error: "Только клиент" });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { bookingId } = parsed.data;
  const b = await pool.query(
    `SELECT id, client_id, status, total_amount_kopeks FROM bookings WHERE id = $1`,
    [bookingId]
  );
  const row = b.rows[0];
  if (!row || row.client_id !== req.userId) {
    res.status(404).json({ error: "Бронь не найдена" });
    return;
  }
  if (row.status !== "pending_payment") {
    res.status(400).json({ error: "Бронь уже оплачена или недоступна" });
    return;
  }
  const amountRub = Number(row.total_amount_kopeks) / 100;
  const pay = await createYooPayment({
    bookingId,
    amountRub,
    description: `SnowRide бронь ${bookingId.slice(0, 8)}`
  });

  if (!pay.paymentId.startsWith("mock_")) {
    await pool.query(`UPDATE bookings SET yookassa_payment_id = $2 WHERE id = $1`, [bookingId, pay.paymentId]);
  }

  res.json({
    paymentId: pay.paymentId,
    confirmationUrl: pay.confirmationUrl,
    status: pay.status
  });
});

paymentRouter.get("/mock-success", async (req, res) => {
  const bookingId = String(req.query.bookingId ?? "");
  if (!bookingId) {
    res.status(400).send("bookingId required");
    return;
  }
  const mockPayId = `mock_${bookingId}`;
  const done = await markBookingPaid(bookingId, mockPayId);
  if (!done) {
    res.status(400).send("Already paid or invalid booking");
    return;
  }
  res.type("html").send(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui;padding:24px">` +
      `<h2>Оплата принята (демо)</h2><p>QR для старта: <code>${done.qr}</code></p>` +
      `<p>Вернитесь в приложение SnowRide.</p></body></html>`
  );
});

paymentRouter.post("/webhook/yookassa", async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const body = req.body as { object?: { status?: string; id?: string; metadata?: { booking_id?: string } } };
    const obj = body.object;
    if (!obj || obj.status !== "succeeded") return;
    const bookingId = obj.metadata?.booking_id;
    const paymentId = obj.id;
    if (!bookingId || !paymentId) return;
    await markBookingPaid(bookingId, paymentId);
  } catch (e) {
    console.error("[yoo webhook]", e);
  }
});
