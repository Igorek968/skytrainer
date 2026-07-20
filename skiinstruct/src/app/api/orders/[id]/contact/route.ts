import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { resolveUserRole } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { buildPaidContactDTO, canRevealOrderContact } from "@/lib/services/paid-contact";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Раскрытие телефона инструктора клиенту после оплаты заказа.
 * Инструктору номер клиента не отдаётся (только чат).
 * Номер не отдаётся в обычном GET заказа — только по явному запросу (кнопка «Позвонить»).
 */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const role = (await resolveUserRole(session.user.id, session.user.role)) ?? session.user.role;
  const userId = session.user.id;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      clientId: true,
      instructorId: true,
      client: { select: { name: true, phone: true } },
      instructor: { select: { name: true, phone: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isClient = order.clientId === userId;
  const isInstructor = order.instructorId === userId;
  if (!isClient && !isInstructor && role !== "ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const asRole: "CLIENT" | "INSTRUCTOR" | "ADMIN" = isClient
    ? "CLIENT"
    : isInstructor
      ? "INSTRUCTOR"
      : "ADMIN";

  if (asRole === "INSTRUCTOR") {
    return NextResponse.json(
      { error: "Телефон клиента недоступен. Свяжитесь через чат заказа." },
      { status: 403 },
    );
  }

  if (!canRevealOrderContact(order.status, asRole)) {
    return NextResponse.json(
      {
        error:
          "Контакт доступен после оплаты. До этого напишите в чат заказа, когда он откроется.",
      },
      { status: 403 },
    );
  }

  const counterpart = order.instructor;
  const contact = buildPaidContactDTO(counterpart?.phone, counterpart?.name);
  if (!contact) {
    return NextResponse.json(
      {
        error: "У инструктора не указан телефон в профиле",
        contact: null,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    contact,
    hint: "Номер показывается только вам в рамках этого заказа. Предпочтительнее сначала написать в чат.",
  });
}
