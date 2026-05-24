import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const events = await prisma.instructorEvent.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
  include: { instructor: { select: { email: true, name: true } } },
});

console.log("=== Events ===");
for (const e of events) {
  console.log({
    id: e.id.slice(-8),
    title: e.title.slice(0, 40),
    status: e.moderationStatus,
    eventAt: e.eventAt?.toISOString(),
    orderId: e.orderId?.slice(-8) ?? null,
    instructor: e.instructor.email,
  });
}

const orders = await prisma.order.findMany({
  where: { instructorId: { not: null } },
  orderBy: { updatedAt: "desc" },
  take: 5,
  select: {
    id: true,
    status: true,
    clientId: true,
    instructorId: true,
    client: { select: { email: true } },
    instructor: { select: { email: true } },
  },
});

console.log("\n=== Recent orders with instructor ===");
for (const o of orders) {
  console.log({
    order: o.id.slice(-8),
    status: o.status,
    client: o.client.email,
    instructor: o.instructor?.email,
  });
}

await prisma.$disconnect();
