import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { ensureInstructorProfile } from "@/lib/instructor-profile-defaults";
import {
  mergeProfileDraft,
  parseProfileDraft,
  snapshotProfileToDraft,
} from "@/lib/instructor-profile-draft";
import { prisma } from "@/lib/prisma";
import {
  normalizeAvailabilitySlots,
  validateAvailabilitySlots,
} from "@/shared/lib/instructor-availability-slots";

const bodySchema = z.object({
  availabilitySlots: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        from: z.string().min(1).max(5),
        to: z.string().min(1).max(5),
        busy: z.boolean().optional(),
      }),
    )
    .max(100),
});

export async function PATCH(req: Request) {
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
    return NextResponse.json({ error: "Некорректные интервалы доступности" }, { status: 400 });
  }

  const normalized = normalizeAvailabilitySlots(parsed.data.availabilitySlots);
  const validationError = validateAvailabilitySlots(normalized);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  await ensureInstructorProfile(userId);

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

  const slotsJson = normalized as Prisma.InputJsonValue;
  const data: Prisma.InstructorProfileUpdateInput = {
    availabilitySlots: slotsJson,
  };

  if (profile.profileDraftStatus === "PENDING_REVIEW") {
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const existing = await prisma.instructorProfile.findUnique({
      where: { userId },
      select: {
        bio: true,
        certificationLevel: true,
        certifications: true,
        skillLevels: true,
        languages: true,
        specializations: true,
        specializationOffers: true,
        additionalServices: true,
        offeredDurations: true,
        achievements: true,
        experienceYears: true,
        sportsExperienceYears: true,
        totalLessons: true,
        age: true,
        availabilitySlots: true,
        cancellationPolicy: true,
        supportContact: true,
        legalInfo: true,
        videoVisitUrl: true,
        hourlyRate: true,
        photoUrl: true,
        photoGallery: true,
        ratingAvg: true,
        reviewCount: true,
      },
    });
    if (existing) {
      const parsedDraft = parseProfileDraft(profile.profileDraft);
      const base =
        parsedDraft ?? snapshotProfileToDraft(existing, userRow?.name ?? null);
      data.profileDraft = mergeProfileDraft(base, {
        availabilitySlots: normalized as Prisma.JsonValue,
      }) as Prisma.InputJsonValue;
    }
  }

  await prisma.instructorProfile.update({
    where: { userId },
    data,
  });

  return NextResponse.json({ ok: true, availabilitySlots: normalized });
}
