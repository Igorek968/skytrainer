import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { startYooCardBinding } from "@/lib/services/client-yookassa-card";
import { yooKassaUserFacingError } from "@/lib/yookassa";

const bodySchema = z.object({
  returnUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  try {
    const resolved = await requireClientSession();
    if (isApiErrorResponse(resolved)) return resolved;

    let json: unknown = {};
    try {
      json = await req.json();
    } catch {
      json = {};
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    const returnUrl = parsed.data.returnUrl ?? `${origin}/client?card=updated`;

    const { url } = await startYooCardBinding(resolved.userId, returnUrl);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      {
        error: yooKassaUserFacingError(e, "Не удалось начать привязку карты"),
        code: "CARD_BIND_UNAVAILABLE",
      },
      { status: 400 },
    );
  }
}
