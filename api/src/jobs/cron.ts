import cron from "node-cron";
import { pool } from "../db/pool.js";
import { sendFcmToUser } from "../services/notifications.js";
import { redis } from "../services/redis.js";

export function startCronJobs(): void {
  cron.schedule("* * * * *", async () => {
    try {
      await remindHourBefore();
      await promptReviewAfterLesson();
      await drainNotificationQueue();
    } catch (e) {
      console.error("[cron]", e);
    }
  });
}

async function remindHourBefore(): Promise<void> {
  const q = await pool.query<{ id: string; client_id: string; instructor_user_id: string }>(
    `SELECT id, client_id, instructor_user_id FROM bookings
     WHERE status IN ('paid','confirmed')
       AND reminder_sent = FALSE
       AND start_at BETWEEN now() + interval '59 minutes' AND now() + interval '61 minutes'`
  );
  for (const row of q.rows) {
    await sendFcmToUser(row.client_id, "Напоминание", "Через час начало занятия на склоне", {
      bookingId: row.id,
      type: "reminder_client"
    });
    await sendFcmToUser(row.instructor_user_id, "Напоминание", "Через час занятие с клиентом", {
      bookingId: row.id,
      type: "reminder_instructor"
    });
    await pool.query(`UPDATE bookings SET reminder_sent = TRUE WHERE id = $1`, [row.id]);
  }
}

async function promptReviewAfterLesson(): Promise<void> {
  const q = await pool.query<{ id: string; client_id: string }>(
    `SELECT b.id, b.client_id FROM bookings b
     LEFT JOIN reviews r ON r.booking_id = b.id
     WHERE b.status = 'completed'
       AND b.review_prompt_sent = FALSE
       AND r.id IS NULL
       AND b.end_at < now() - interval '1 hour'`
  );
  for (const row of q.rows) {
    await sendFcmToUser(row.client_id, "Оцените занятие", "Оставьте отзыв инструктору в приложении", {
      bookingId: row.id,
      type: "review_prompt"
    });
    await pool.query(`UPDATE bookings SET review_prompt_sent = TRUE WHERE id = $1`, [row.id]);
  }
}

async function drainNotificationQueue(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const raw = await redis.rpop("notifications:queue");
    if (!raw) break;
    try {
      const job = JSON.parse(raw) as { userId?: string; title?: string; body?: string };
      if (job.userId && job.title && job.body) {
        await sendFcmToUser(job.userId, job.title, job.body);
      }
    } catch {
      /* ignore */
    }
  }
}
