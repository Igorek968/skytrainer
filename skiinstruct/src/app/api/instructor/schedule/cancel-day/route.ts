import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { cancelInstructorDayOrders } from "@/lib/services/instructor-schedule";

const bodySchema = z.object({
  lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const resolved = await requireInstructorSession();
  if (isApiErrorResponse(resolved)) return resolved;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Укажите дату (YYYY-MM-DD)" }, { status: 400 });
  }

  const { cancelledIds } = await cancelInstructorDayOrders({
    instructorId: resolved.userId,
    lessonDateYmd: parsed.data.lessonDate,
    actorUserId: resolved.userId,
  });

  return NextResponse.json({
    cancelledIds,
    count: cancelledIds.length,
    message:
      cancelledIds.length > 0
        ? `Отменено записей: ${cancelledIds.length}. Клиентам оформлен возврат.`
        : "На эту дату активных записей не найдено.",
  });
}
