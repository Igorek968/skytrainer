/**
 * Проверка SMTP из контейнера:
 *   docker compose --env-file .env.qa -f docker-compose.qa.yml exec skiinstruct node scripts/test-smtp.mjs you@example.com
 */
import nodemailer from "nodemailer";

const to = process.argv[2]?.trim();
if (!to) {
  console.error("Usage: node scripts/test-smtp.mjs <recipient-email>");
  process.exit(1);
}

const host = process.env.SMTP_HOST?.trim();
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASSWORD?.trim() ?? process.env.SMTP_PASS?.trim();
const port = Number(process.env.SMTP_PORT?.trim() || "465");
const secure =
  process.env.SMTP_SECURE === "0" || process.env.SMTP_SECURE === "false"
    ? false
    : port === 465 || process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true";

if (!host || !user || !pass) {
  console.error("Missing SMTP_HOST, SMTP_USER or SMTP_PASSWORD in environment");
  process.exit(1);
}

console.log(`Testing ${host}:${port} secure=${secure} user=${user} -> ${to}`);

const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
});

try {
  await transport.verify();
  console.log("SMTP verify: OK");
} catch (e) {
  console.error("SMTP verify FAILED:", e?.message ?? e);
  if (String(e?.message).includes("535")) {
    console.error(
      "→ Неверный логин/пароль ящика. Задайте пароль в панели Beget для",
      user,
      "и обновите SKIINSTRUCT_SMTP_PASSWORD в .env.qa, затем: docker compose restart skiinstruct",
    );
  }
  process.exit(2);
}

const from =
  process.env.PASSWORD_RESET_EMAIL_FROM?.trim() ||
  process.env.SMTP_FROM?.trim() ||
  `Test <${user}>`;

const info = await transport.sendMail({
  from,
  to,
  subject: "ТвойТренер.рф SMTP test",
  text: "If you received this, SMTP works.",
});

console.log("Sent:", info.messageId);
