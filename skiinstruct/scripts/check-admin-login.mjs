import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const candidates = [
  { email: "admin@example.com", password: "Password123!" },
  { email: "admin@skiinstruct.local", password: "Admin12345!" },
];

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true, passwordHash: true },
  });
  console.log("ADMIN users in DB:", admins.map((a) => a.email));

  for (const { email, password } of candidates) {
    const u = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!u?.passwordHash) {
      console.log(`${email}: not found`);
      continue;
    }
    const ok = await bcrypt.compare(password, u.passwordHash);
    console.log(`${email} + ${password}: ${ok ? "OK" : "wrong password"}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
