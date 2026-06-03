import nodemailer from "nodemailer";

const user = process.env.SMTP_USER?.trim();
const pass = (process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS ?? "").trim().replace(/^["']|["']$/g, "");
if (!user || !pass) {
  console.error("Need SMTP_USER and SMTP_PASSWORD");
  process.exit(1);
}

const profiles = [
  { name: "465 SSL", host: "smtp.beget.com", port: 465, secure: true },
  { name: "587 STARTTLS", host: "smtp.beget.com", port: 587, secure: false, requireTLS: true },
  { name: "2525 STARTTLS", host: "smtp.beget.com", port: 2525, secure: false, requireTLS: true },
];

for (const p of profiles) {
  const t = nodemailer.createTransport({
    host: p.host,
    port: p.port,
    secure: p.secure,
    requireTLS: p.requireTLS,
    auth: { user, pass },
  });
  try {
    await t.verify();
    console.log(`OK  ${p.name}`);
  } catch (e) {
    console.log(`FAIL ${p.name}:`, e?.message ?? e);
  }
}
