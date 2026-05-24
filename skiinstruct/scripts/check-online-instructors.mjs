import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const online = await prisma.user.findMany({
  where: {
    role: "INSTRUCTOR",
    instructorProfile: { verificationStatus: "APPROVED", isOnline: true },
  },
  select: { name: true, email: true, instructorProfile: { select: { isOnline: true, specializations: true } } },
});

const all = await prisma.user.findMany({
  where: {
    role: "INSTRUCTOR",
    instructorProfile: { verificationStatus: "APPROVED" },
  },
  select: { name: true, email: true, instructorProfile: { select: { isOnline: true, specializations: true } } },
});

console.log("online count:", online.length);
console.log(JSON.stringify(online, null, 2));
console.log("all approved count:", all.length);
console.log(
  "online flags:",
  all.map((u) => ({ name: u.name, isOnline: u.instructorProfile?.isOnline })),
);

await prisma.$disconnect();
