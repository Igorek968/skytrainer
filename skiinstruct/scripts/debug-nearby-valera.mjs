import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const valera = await prisma.user.findFirst({
  where: { email: "instructor1@ya.ru" },
  include: { instructorProfile: true },
});

console.log(JSON.stringify(valera, null, 2));

await prisma.$disconnect();
