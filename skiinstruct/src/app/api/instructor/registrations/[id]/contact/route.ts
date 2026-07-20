import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { buildPaidContactDTO, canRevealRegistrationContact } from "@/lib/services/paid-contact";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Телефон клиента после записи на мероприятие (в т.ч. до оплаты после события). */
export async function GET(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id } = await ctx.params;
  const reg = await prisma.eventRegistration.findFirst({
    where: { id, event: { instructorId: userId } },
    select: {
      status: true,
      amountRub: true,
      client: { select: { name: true, phone: true } },
    },
  });

  if (!reg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const amount = Number(reg.amountRub);
  if (!canRevealRegistrationContact(reg.status, amount)) {
    return NextResponse.json(
      { error: "Контакт клиента недоступен для этой заявки" },
      { status: 403 },
    );
  }

  const contact = buildPaidContactDTO(reg.client.phone, reg.client.name);
  if (!contact) {
    return NextResponse.json(
      { error: "У клиента не указан телефон в профиле", contact: null },
      { status: 404 },
    );
  }

  return NextResponse.json({
    contact,
    hint: "Номер только для связи по этой записи. Не передавайте его третьим лицам.",
  });
}
