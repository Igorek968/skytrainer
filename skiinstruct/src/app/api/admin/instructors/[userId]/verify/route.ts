import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { draftToProfileUpdate, parseProfileDraft } from "@/lib/instructor-profile-draft";
import { prisma } from "@/lib/prisma";
import { findDuplicateParticipantByDisplayName } from "@/lib/services/user-display-name-uniqueness";
import { DISPLAY_NAME_DUPLICATE_MESSAGE } from "@/lib/user-display-name";

const bodySchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectMessage: z.string().trim().min(3).max(2000).optional(),
  })
  .refine((d) => d.status !== "REJECTED" || Boolean(d.rejectMessage?.trim()), {
    message: "Укажите причину отказа (не менее 3 символов)",
    path: ["rejectMessage"],
  });

type Ctx = { params: Promise<{ userId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  if (parsed.data.status === "REJECTED") {
    await prisma.instructorProfile.update({
      where: { userId },
      data: {
        verificationStatus: "REJECTED",
        profileDraft: Prisma.JsonNull,
        profileDraftStatus: "NONE",
        profileDraftSubmittedAt: null,
        profileDraftRejectNote: parsed.data.rejectMessage!.trim(),
        profileDraftRejectedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  const draft =
    profile.profileDraftStatus === "PENDING_REVIEW"
      ? parseProfileDraft(profile.profileDraft)
      : null;

  if (draft) {
    const draftFirst = draft.firstName?.trim() ?? "";
    const draftLast = draft.lastName?.trim() ?? "";
    if (draftFirst && draftLast) {
      const duplicate = await findDuplicateParticipantByDisplayName(userId, draftFirst, draftLast);
      if (duplicate) {
        return NextResponse.json({ error: DISPLAY_NAME_DUPLICATE_MESSAGE }, { status: 409 });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    if (draft) {
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
          verificationStatus: "APPROVED",
          profileDraft: Prisma.JsonNull,
          profileDraftStatus: "NONE",
          profileDraftSubmittedAt: null,
          profileDraftRejectNote: null,
          profileDraftRejectedAt: null,
        },
      });
      return;
    }

    await tx.instructorProfile.update({
      where: { userId },
      data: {
        verificationStatus: "APPROVED",
        profileDraftRejectNote: null,
        profileDraftRejectedAt: null,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
