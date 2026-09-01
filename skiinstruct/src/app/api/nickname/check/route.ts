import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  NICKNAME_SLUG_INVALID_MESSAGE,
  NICKNAME_TAKEN_MESSAGE,
  nicknameToProfileSlug,
} from "@/lib/instructor-profile-slug";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findDuplicateInstructorNickname } from "@/lib/services/instructor-nickname-uniqueness";

const querySchema = z.object({
  nickname: z.string().trim().max(80),
});

export async function GET(req: Request) {
  const ip = clientIp(req.headers);
  const session = await auth();
  const rateKey = session?.user?.id ? `nickname:${session.user.id}` : `nickname:${ip}`;
  if (!rateLimit(rateKey, 40, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Укажите никнейм" }, { status: 400 });
  }

  const { nickname } = parsed.data;
  if (nickname.length < 2) {
    return NextResponse.json({ duplicate: false, invalid: false, slug: null });
  }

  const slug = nicknameToProfileSlug(nickname);
  if (!slug) {
    return NextResponse.json({
      duplicate: false,
      invalid: true,
      slug: null,
      message: NICKNAME_SLUG_INVALID_MESSAGE,
    });
  }

  const duplicate = await findDuplicateInstructorNickname(session?.user?.id ?? null, nickname);
  return NextResponse.json({
    duplicate,
    invalid: false,
    slug,
    message: duplicate ? NICKNAME_TAKEN_MESSAGE : null,
  });
}
