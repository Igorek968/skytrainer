import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const { compare } = bcrypt;

const email = process.argv[2] ?? "viva-r@yandex.ru";
const password = process.argv[3] ?? "Password123!";

const p = new PrismaClient();
const u = await p.user.findFirst({
  where: { email: { equals: email, mode: "insensitive" } },
  select: { email: true, role: true, passwordHash: true },
});
console.log("user", u);
if (u?.passwordHash) {
  console.log("password ok", await compare(password, u.passwordHash));
}
await p.$disconnect();
