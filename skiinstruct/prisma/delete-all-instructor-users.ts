import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Удаляет всех пользователей с ролью INSTRUCTOR (анкета InstructorProfile уходит каскадом).
 * Заказы сохраняются: instructorId обнуляется (onDelete: SetNull).
 */
async function main() {
  const res = await prisma.user.deleteMany({
    where: { role: "INSTRUCTOR" },
  });
  console.log(`Удалено учёток инструкторов: ${res.count}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
