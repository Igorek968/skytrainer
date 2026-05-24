import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import {
  draftToProfileUpdate,
  parseProfileDraft,
} from "@/lib/instructor-profile-draft";
import { prisma } from "@/lib/prisma";

const bodySchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    rejectMessage: z.string().trim().min(3).max(2000).optional(),
  })
  .refine((d) => d.action !== "reject" || Boolean(d.rejectMessage?.trim()), {
    message: "Укажите причину отказа (не менее 3 символов)",
    path: ["rejectMessage"],
  });

type Ctx = { params: Promise<{ userId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { userId } = await ctx.params;

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

  const profile = await prisma.instructorProfile.findUnique({
    where: { userId },
    select: {
      profileDraft: true,
      profileDraftStatus: true,
    },
  });

  if (!profile || profile.profileDraftStatus !== "PENDING_REVIEW") {
    return NextResponse.json({ error: "Нет изменений на модерации" }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    await prisma.instructorProfile.update({
      where: { userId },
      data: {
        profileDraft: Prisma.JsonNull,
        profileDraftStatus: "NONE",
        profileDraftSubmittedAt: null,
        profileDraftRejectNote: parsed.data.rejectMessage!.trim(),
        profileDraftRejectedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  const draft = parseProfileDraft(profile.profileDraft);
  if (!draft) {
    return NextResponse.json({ error: "Черновик повреждён" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const first = draft.firstName?.trim() ?? "";
    const last = draft.lastName?.trim() ?? "";
    const fullName = [first, last].filter(Boolean).join(" ");
    if (draft.firstName !== undefined || draft.lastName !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { name: fullName || null },
      });
    }

    await tx.instructorProfile.update({
      where: { userId },
      data: {
        ...draftToProfileUpdate(draft),
        profileDraft: Prisma.JsonNull,
        profileDraftStatus: "NONE",
        profileDraftSubmittedAt: null,
        profileDraftRejectNote: null,
        profileDraftRejectedAt: null,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
