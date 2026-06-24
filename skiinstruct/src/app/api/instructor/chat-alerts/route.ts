import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "PENDING_INSTRUCTOR",
  "ACCEPTED",
  "INSTRUCTOR_EN_ROUTE",
  "LESSON_STARTED",
  "COMPLETED",
  "AWAITING_PAYMENT",
];

/** Последние сообщения клиентов по заказам инструктора (для оповещений в кабинете). */
export async function GET() {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await prisma.message.findMany({
    where: {
      createdAt: { gte: since },
      order: {
        instructorId: userId,
        status: { in: ACTIVE_ORDER_STATUSES },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      body: true,
      createdAt: true,
      orderId: true,
      senderId: true,
      order: {
        select: {
          clientId: true,
          client: { select: { name: true } },
        },
      },
    },
  });

  const messages = rows
    .filter((m) => m.senderId === m.order.clientId)
    .slice(0, 40)
    .map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      orderId: m.orderId,
      clientName: m.order.client?.name ?? null,
    }));

  return NextResponse.json({ messages });
}
