import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findDuplicateParticipantByDisplayName } from "@/lib/services/user-display-name-uniqueness";
import { DISPLAY_NAME_DUPLICATE_MESSAGE } from "@/lib/user-display-name";

const querySchema = z.object({
  firstName: z.string().trim().max(80),
  lastName: z.string().trim().max(80),
});

export async function GET(req: Request) {
  const ip = clientIp(req.headers);
  const session = await auth();
  const rateKey = session?.user?.id ? `display-name:${session.user.id}` : `display-name:${ip}`;
  if (!rateLimit(rateKey, 40, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Укажите имя и фамилию" }, { status: 400 });
  }

  const { firstName, lastName } = parsed.data;
  if (!firstName || !lastName) {
    return NextResponse.json({ duplicate: false });
  }

  const duplicate = await findDuplicateParticipantByDisplayName(
    session?.user?.id ?? null,
    firstName,
    lastName,
  );

  return NextResponse.json({
    duplicate,
    message: duplicate ? DISPLAY_NAME_DUPLICATE_MESSAGE : null,
  });
}
