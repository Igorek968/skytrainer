import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const clientEmail = "viva-r@yandex.ru";
const client = await prisma.user.findUnique({
  where: { email: clientEmail },
  select: { id: true, role: true, email: true },
});

console.log("Client:", client);

if (!client) {
  await prisma.$disconnect();
  process.exit(0);
}

const VISIBLE = [
  "PENDING_INSTRUCTOR",
  "ACCEPTED",
  "INSTRUCTOR_EN_ROUTE",
  "LESSON_STARTED",
  "COMPLETED",
];

const orders = await prisma.order.findMany({
  where: {
    clientId: client.id,
    instructorId: { not: null },
    status: { in: VISIBLE },
  },
  select: { id: true, instructorId: true, status: true },
});

console.log("Matching orders:", orders.length, orders);

const instructorIds = [...new Set(orders.map((o) => o.instructorId).filter(Boolean))];
const orderIds = orders.map((o) => o.id);

const rows = await prisma.instructorEvent.findMany({
  where: {
    instructorId: { in: instructorIds },
    moderationStatus: "PUBLISHED",
    OR: [{ orderId: null }, { orderId: { in: orderIds } }],
  },
});

console.log("Events for feed:", rows.length, rows.map((r) => r.title));

await prisma.$disconnect();
