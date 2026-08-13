import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SKIINSTRUCT_MODERATOR_EMAIL?.trim();
  const password = process.env.SKIINSTRUCT_MODERATOR_PASSWORD?.trim();
  const name = process.env.SKIINSTRUCT_MODERATOR_NAME?.trim() || "Модератор";

  if (!email || !password) {
    console.log(
      "Skip moderator bootstrap: set SKIINSTRUCT_MODERATOR_EMAIL and SKIINSTRUCT_MODERATOR_PASSWORD",
    );
    return;
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      role: "MODERATOR",
      name,
      passwordHash,
    },
    create: {
      email,
      name,
      role: "MODERATOR",
      passwordHash,
    },
  });

  console.log(`Moderator bootstrap OK: ${email}`);
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
