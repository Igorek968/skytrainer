import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { draftToProfileUpdate, parseProfileDraft } from "@/lib/instructor-profile-draft";
import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { notifyBotInstructorApproved } from "@/lib/bot-api";
import { writeAdminAudit } from "@/lib/services/admin-audit";
import { notifyInstructorVerificationResult } from "@/lib/services/instructor-verification-notify";
import { findDuplicateParticipantByDisplayName } from "@/lib/services/user-display-name-uniqueness";
import { DISPLAY_NAME_DUPLICATE_MESSAGE } from "@/lib/user-display-name";

const bodySchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectMessage: z.string().trim().min(3).max(2000).optional(),
    /** Одобрить выбранные compliance-документы вместе с анкетой. */
    approveDocumentIds: z.array(z.string().cuid()).max(20).optional(),
  })
  .refine((d) => d.status !== "REJECTED" || Boolean(d.rejectMessage?.trim()), {
    message: "Укажите причину отказа (не менее 3 символов)",
    path: ["rejectMessage"],
  });

type Ctx = { params: Promise<{ userId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

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

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  const targetLabel = target?.name?.trim() || target?.email || userId;

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
    void notifyInstructorVerificationResult({
      userId,
      status: "REJECTED",
      rejectMessage: parsed.data.rejectMessage!.trim(),
    });
    await writeAdminAudit({
      actorId: auth.userId,
      action: "instructor.reject",
      entity: "InstructorProfile",
      entityId: userId,
      summary: `Отклонена заявка инструктора ${targetLabel}`,
      meta: { rejectMessage: parsed.data.rejectMessage!.trim(), actorRole: auth.role },
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
    } else {
      await tx.instructorProfile.update({
        where: { userId },
        data: {
          verificationStatus: "APPROVED",
          profileDraftRejectNote: null,
          profileDraftRejectedAt: null,
        },
      });
    }

    const approveIds = parsed.data.approveDocumentIds?.filter(Boolean) ?? [];
    if (approveIds.length > 0) {
      await tx.instructorComplianceDocument.updateMany({
        where: {
          userId,
          id: { in: approveIds },
          status: "PENDING",
        },
        data: { status: "APPROVED", rejectNote: null },
      });
    }
  });

  void notifyInstructorVerificationResult({ userId, status: "APPROVED" });
  notifyBotInstructorApproved(userId);
  void import("@/lib/services/yookassa-instructor-contract-notify")
    .then(({ notifyYookassaInstructorContract }) =>
      notifyYookassaInstructorContract(userId),
    )
    .catch((e) =>
      console.error("[yookassa-contract] approve", e instanceof Error ? e.message : e),
    );
  await writeAdminAudit({
    actorId: auth.userId,
    action: "instructor.approve",
    entity: "InstructorProfile",
    entityId: userId,
    summary: `Одобрена заявка инструктора ${targetLabel}`,
    meta: {
      approveDocumentIds: parsed.data.approveDocumentIds ?? [],
      actorRole: auth.role,
    },
  });
  return NextResponse.json({ ok: true });
}
