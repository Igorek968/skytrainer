/**
 * Сводка реферальных кодов (только чтение).
 * docker compose exec -T skiinstruct node prisma/referral-coverage.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const [byRole, withCode, withoutCode, referred] = await Promise.all([
  prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  prisma.user.groupBy({
    by: ["role"],
    where: { referralCode: { not: null } },
    _count: { _all: true },
  }),
  prisma.user.count({
    where: {
      role: { in: ["CLIENT", "INSTRUCTOR"] },
      referralCode: null,
    },
  }),
  prisma.user.groupBy({
    by: ["role"],
    where: { referredById: { not: null } },
    _count: { _all: true },
  }),
]);

console.log(
  JSON.stringify(
    {
      users: byRole.map((r) => ({ role: r.role, n: r._count._all })),
      withReferralCode: withCode.map((r) => ({ role: r.role, n: r._count._all })),
      clientsInstructorsWithoutCode: withoutCode,
      referredByRole: referred.map((r) => ({ role: r.role, n: r._count._all })),
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
