/**
 * Выдать реферальный код всем клиентам и инструкторам, у кого его ещё нет.
 * docker compose exec -T skiinstruct node prisma/ensure-all-referral-codes.mjs
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 8) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out.toLowerCase();
}

function slugFromNickname(nickname) {
  const slug = String(nickname ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  if (slug.length < 3 || slug.length > 40 || slug === "page") return null;
  return slug;
}

const users = await prisma.user.findMany({
  where: { role: { in: ["CLIENT", "INSTRUCTOR"] }, referralCode: null },
  select: { id: true, role: true, email: true, nickname: true },
});

let assigned = 0;
const failed = [];
for (const user of users) {
  const candidates = [];
  if (user.role === "INSTRUCTOR") {
    const slug = slugFromNickname(user.nickname);
    if (slug) {
      candidates.push(slug);
      for (let n = 2; n <= 8; n++) candidates.push(`${slug}-${n}`);
    }
  }
  for (let i = 0; i < 8; i++) candidates.push(randomCode());

  let ok = false;
  for (const code of candidates) {
    try {
      await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
      assigned += 1;
      ok = true;
      break;
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") continue;
      failed.push({ email: user.email, error: String(e) });
      ok = true;
      break;
    }
  }
  if (!ok) failed.push({ email: user.email, error: "no unique code" });
}

const left = await prisma.user.count({
  where: { role: { in: ["CLIENT", "INSTRUCTOR"] }, referralCode: null },
});
console.log(JSON.stringify({ scanned: users.length, assigned, leftWithoutCode: left, failed }, null, 2));
await prisma.$disconnect();
