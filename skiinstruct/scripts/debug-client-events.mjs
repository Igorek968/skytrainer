import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const VISIBLE = [
  "PENDING_INSTRUCTOR",
  "ACCEPTED",
  "INSTRUCTOR_EN_ROUTE",
  "LESSON_STARTED",
  "COMPLETED",
];

async function main() {
  const emails = ["viva-r@yandex.ru", "donskix-48@yandex.ru"];
  const users = await p.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, role: true },
  });
  console.log("USERS:", users);

  const client = users.find((u) => u.email === "viva-r@yandex.ru");
  const instr = users.find((u) => u.email === "donskix-48@yandex.ru");
  if (!client) {
    console.log("Client viva-r not found");
    return;
  }
  if (!instr) {
    console.log("Instructor donskix not found");
    return;
  }

  const allOrders = await p.order.findMany({
    where: { clientId: client.id },
    select: {
      id: true,
      status: true,
      instructorId: true,
      instructor: { select: { email: true, name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("\nALL ORDERS for viva-r:", allOrders);

  const pairOrders = allOrders.filter((o) => o.instructorId === instr.id);
  const visiblePair = pairOrders.filter((o) => VISIBLE.includes(o.status));
  console.log("\nOrders with donskix:", pairOrders.length, "visible:", visiblePair.length);

  const events = await p.instructorEvent.findMany({
    where: { instructorId: instr.id },
    select: {
      id: true,
      title: true,
      moderationStatus: true,
      orderId: true,
      eventAt: true,
      publishedAt: true,
      submittedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log("\nEVENTS by donskix:", events);

  const instructorIds = [
    ...new Set(
      allOrders
        .filter((o) => o.instructorId && VISIBLE.includes(o.status))
        .map((o) => o.instructorId),
    ),
  ];
  const orderIds = allOrders.filter((o) => VISIBLE.includes(o.status)).map((o) => o.id);

  const apiEvents = await p.instructorEvent.findMany({
    where: {
      instructorId: { in: instructorIds },
      moderationStatus: "PUBLISHED",
      OR: [{ orderId: null }, { orderId: { in: orderIds } }],
    },
    select: { id: true, title: true, instructorId: true, orderId: true },
  });
  console.log("\nWhat API would return for viva-r:", apiEvents);
  console.log("\nAUTO_APPROVE env:", process.env.SKIINSTRUCT_AUTO_APPROVE_EVENTS ?? "(unset)");
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
