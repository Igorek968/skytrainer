import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "PENDING_INSTRUCTOR",
  "ACCEPTED",
  "INSTRUCTOR_EN_ROUTE",
  "LESSON_STARTED",
  "COMPLETED",
  "AWAITING_PAYMENT",
];

/** Последние сообщения инструкторов по заказам клиента (оповещения в кабинете). */
export async function GET() {
  const authResult = await requireClientSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await prisma.message.findMany({
    where: {
      createdAt: { gte: since },
      order: {
        clientId: userId,
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
          instructorId: true,
          instructor: { select: { name: true } },
        },
      },
    },
  });

  const messages = rows
    .filter((m) => m.senderId === m.order.instructorId)
    .slice(0, 40)
    .map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      orderId: m.orderId,
      instructorName: m.order.instructor?.name ?? null,
    }));

  return NextResponse.json({ messages });
}
