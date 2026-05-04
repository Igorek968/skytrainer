import { pool } from "../db/pool.js";
import { config } from "../config.js";

export async function sendFcmToUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
  const r = await pool.query<{ fcm_token: string | null }>(`SELECT fcm_token FROM users WHERE id = $1`, [userId]);
  const token = r.rows[0]?.fcm_token;
  if (!token) {
    console.log(`[FCM skip no token] user=${userId} ${title}: ${body}`);
    return;
  }
  if (!config.fcmServerKey) {
    console.log(`[FCM no key] ${title}: ${body} → ${userId}`);
    return;
  }
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${config.fcmServerKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: token,
      notification: { title, body, sound: "default" },
      data: data ?? {}
    })
  });
  if (!res.ok) {
    console.error("[FCM error]", await res.text());
  }
}
