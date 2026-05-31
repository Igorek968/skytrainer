import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const res = await prisma.user.deleteMany({
    where: {
      role: "INSTRUCTOR",
      OR: [
        { email: { startsWith: "demo-skier-" } },
        { email: { startsWith: "same-day-instructor" } },
        { email: { startsWith: "future-day-instructor" } },
      ],
    },
  });
  console.log(`Удалено демо-инструкторов: ${res.count}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
