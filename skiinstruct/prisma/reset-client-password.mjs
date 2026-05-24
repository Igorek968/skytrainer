/**
 * Сброс пароля клиента для локальной отладки.
 * Пример: node prisma/reset-client-password.mjs viva-r@yandex.ru Password123!
 */
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const { hash } = require("bcryptjs");

const email = process.argv[2];
const password = process.argv[3] ?? "Password123!";

if (!email) {
  console.error("Usage: node prisma/reset-client-password.mjs <email> [password]");
  process.exit(1);
}

const p = new PrismaClient();
const user = await p.user.findFirst({
  where: { email: { equals: email, mode: "insensitive" } },
});
if (!user) {
  console.error("User not found:", email);
  process.exit(1);
}
if (user.role !== "CLIENT") {
  console.error("Not a CLIENT user, role =", user.role);
  process.exit(1);
}

const passwordHash = await hash(password, 12);
await p.user.update({ where: { id: user.id }, data: { passwordHash } });
console.log("OK:", user.email, "-> password reset");

await p.$disconnect();
