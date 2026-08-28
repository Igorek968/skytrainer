/**
 * Привязать уже созданных инструкторов к рефереру (разовый бэкап).
 * node prisma/bind-instructor-referrals.mjs <code> <email> [email...]
 *
 * docker compose exec -T skiinstruct node prisma/bind-instructor-referrals.mjs leragaidar a@mail.ru
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const code = String(process.argv[2] ?? "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, "");
const emails = process.argv
  .slice(3)
  .map((e) => String(e).trim().toLowerCase())
  .filter(Boolean);

if (!code || emails.length === 0) {
  console.error("Usage: node prisma/bind-instructor-referrals.mjs <referralCode> <email> [email...]");
  process.exit(1);
}

const referrer = await prisma.user.findFirst({
  where: { referralCode: { equals: code, mode: "insensitive" } },
  select: { id: true, email: true, referralCode: true, role: true },
});
if (!referrer) {
  console.error("Referrer not found for code", code);
  process.exit(1);
}

const results = [];
for (const email of emails) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, role: true, referredById: true },
  });
  if (!user) {
    results.push({ email, status: "NOT_FOUND" });
    continue;
  }
  if (user.role !== "INSTRUCTOR") {
    results.push({ email, status: "SKIP_ROLE", role: user.role });
    continue;
  }
  if (user.id === referrer.id) {
    results.push({ email, status: "SKIP_SELF" });
    continue;
  }
  if (user.referredById) {
    results.push({
      email,
      status: user.referredById === referrer.id ? "ALREADY" : "SKIP_OTHER_REFERRER",
    });
    continue;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { referredById: referrer.id },
  });
  results.push({ email, status: "BOUND" });
}

const invitedCount = await prisma.user.count({ where: { referredById: referrer.id } });
console.log(
  JSON.stringify(
    {
      referrer: { email: referrer.email, code: referrer.referralCode, role: referrer.role },
      results,
      invitedCount,
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
