import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { notifyBotInstructorOnline } from "@/lib/bot-api";
import { ensureInstructorProfile } from "@/lib/instructor-profile-defaults";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  isOnline: z.boolean(),
});

export async function POST(req: Request) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await ensureInstructorProfile(userId);

  const prev = await prisma.instructorProfile.findUnique({
    where: { userId },
    select: { isOnline: true },
  });

  if (parsed.data.isOnline) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { suspendedAt: true },
    });
    if (user?.suspendedAt) {
      return NextResponse.json(
        { error: "Аккаунт временно заблокирован — выход на линию недоступен" },
        { status: 403 },
      );
    }
  }

  await prisma.instructorProfile.updateMany({
    where: { userId },
    data: { isOnline: parsed.data.isOnline },
  });

  if (parsed.data.isOnline && !prev?.isOnline) {
    notifyBotInstructorOnline(userId);
  }

  return NextResponse.json({ ok: true });
}
