import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SKIINSTRUCT_ADMIN_EMAIL?.trim();
  const password = process.env.SKIINSTRUCT_ADMIN_PASSWORD?.trim();
  const name = process.env.SKIINSTRUCT_ADMIN_NAME?.trim() || "Администратор";

  if (!email || !password) {
    console.log(
      "Skip admin bootstrap: set SKIINSTRUCT_ADMIN_EMAIL and SKIINSTRUCT_ADMIN_PASSWORD"
    );
    return;
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      name,
      passwordHash,
    },
    create: {
      email,
      name,
      role: "ADMIN",
      passwordHash,
    },
  });

  console.log(`Admin bootstrap OK: ${email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
