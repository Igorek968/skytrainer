import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { ensureInstructorProfile } from "@/lib/instructor-profile-defaults";
import { publicUploadDisplaySrc, publicUploadDisplaySrcs } from "@/lib/public-uploads-display";
import { prisma } from "@/lib/prisma";
import {
  buildDraftPatchFromMePayload,
  draftAsProfileView,
  mergeProfileDraft,
  parseProfileDraft,
  snapshotProfileToDraft,
  type InstructorProfileDraftPayload,
} from "@/lib/instructor-profile-draft";
import { isAutoInstructorLabel, validateDrivingSchoolDetails } from "@/lib/auto-instructor-offer";
import {
  normalizeSpecializationOffer,
  parseSpecializationOffers,
  type SpecializationOffer,
} from "@/lib/instructor-specialization-offers";
import {
  canonicalizeActivityLabel,
  canonicalizeActivityLabels,
  repairStaleCatalogSyntheticBio,
  syncSyntheticBioLineWithSpecs,
} from "@/lib/services/instructor-match";

const drivingDetailsSchema = z.object({
  vehicleOptions: z
    .array(z.enum(["INSTRUCTOR_CAR", "STUDENT_CAR"]))
    .min(1)
    .max(2),
  transmissions: z.array(z.enum(["MANUAL", "AUTOMATIC", "ANY"])).min(1).max(3),
  licenseCategories: z
    .array(z.enum(["M", "A", "B", "C", "D", "BE_CE_DE", "C1_D1", "TM", "TB"]))
    .min(1)
    .max(9),
});

const offerSchema = z.object({
  label: z.string().min(1).max(80),
  hourlyRate: z.number().min(500).max(100_000),
  lessonsCompleted: z.number().int().min(0).max(100_000).optional().default(0),
  drivingDetails: drivingDetailsSchema.optional(),
});

const updateSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  bio: z.string().max(2000).optional(),
  certificationLevel: z.string().max(120).optional(),
  certifications: z.array(z.string().min(1).max(80)).max(12).optional(),
  skillLevels: z.array(z.string().min(1).max(40)).max(8).optional(),
  languages: z.array(z.string().min(1).max(40)).max(12).optional(),
  specializations: z.array(z.string().min(1).max(80)).max(12).optional(),
  specializationOffers: z.array(offerSchema).max(12).optional(),
  additionalServices: z.array(z.string().min(1).max(80)).max(12).optional(),
  offeredDurations: z.array(z.string().min(1).max(30)).max(10).optional(),
  achievements: z.array(z.string().min(1).max(200)).max(20).optional(),
  experienceYears: z.number().int().min(0).max(80).optional(),
  sportsExperienceYears: z.number().int().min(0).max(80).optional(),
  totalLessons: z.number().int().min(0).max(100000).optional(),
  age: z.number().int().min(0).max(90).optional(),
  availabilitySlots: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        from: z.string().min(1).max(5),
        to: z.string().min(1).max(5),
        busy: z.boolean().optional(),
      })
    )
    .max(100)
    .optional(),
  cancellationPolicy: z.string().max(2000).optional(),
  supportContact: z.string().max(160).optional(),
  legalInfo: z.string().max(2000).optional(),
  videoVisitUrl: z.union([z.string().url().max(1000), z.literal("")]).optional(),
  hourlyRate: z.number().min(500).max(100000).optional(),
  photoUrl: z
    .union([
      z.string().url().max(1000),
      z.string().regex(/^\/uploads\/.*/),
      z.literal(""),
    ])
    .optional(),
});

function formatMeProfileResponse(
  view: ReturnType<typeof draftAsProfileView>,
  ratingAvg: number,
  reviewCount: number,
) {
  const canonSpecs = canonicalizeActivityLabels(view.specializations);
  const offersForResponse = parseSpecializationOffers(
    view.specializationOffers,
    Number(view.hourlyRate),
    view.specializations,
  );
  return {
    firstName: view.firstName,
    lastName: view.lastName,
    bio: repairStaleCatalogSyntheticBio(view.bio, canonSpecs),
    certificationLevel: view.certificationLevel ?? "",
    certifications: view.certifications,
    skillLevels: view.skillLevels,
    languages: view.languages,
    specializations: canonSpecs,
    specializationOffers: offersForResponse,
    additionalServices: view.additionalServices,
    offeredDurations: view.offeredDurations,
    achievements: view.achievements,
    experienceYears: view.experienceYears ?? null,
    sportsExperienceYears: view.sportsExperienceYears ?? null,
    totalLessons: view.totalLessons ?? null,
    age: view.age ?? null,
    availabilitySlots: (view.availabilitySlots as InstructorProfileDraftPayload["availabilitySlots"]) ?? [],
    cancellationPolicy: view.cancellationPolicy ?? "",
    supportContact: view.supportContact ?? "",
    legalInfo: view.legalInfo ?? "",
    videoVisitUrl: view.videoVisitUrl ?? "",
    hourlyRate: Number(view.hourlyRate),
    photoUrl: publicUploadDisplaySrc(view.photoUrl) ?? "",
    photoGallery: publicUploadDisplaySrcs(view.photoGallery),
    ratingAvg,
    reviewCount,
  };
}

export async function GET() {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  await ensureInstructorProfile(userId);

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
    prisma.instructorProfile.findUnique({
      where: { userId },
      select: {
        isOnline: true,
        verificationStatus: true,
        profileDraft: true,
        profileDraftStatus: true,
        profileDraftSubmittedAt: true,
        profileDraftRejectNote: true,
        profileDraftRejectedAt: true,
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
    }),
  ]);
  const pendingDraft = profile?.profileDraftStatus === "PENDING_REVIEW";
  const parsedDraft = pendingDraft ? parseProfileDraft(profile.profileDraft) : null;

  const view = profile
    ? parsedDraft
      ? draftAsProfileView(parsedDraft)
      : draftAsProfileView(snapshotProfileToDraft(profile, user?.name ?? null))
    : null;

  return NextResponse.json({
    isOnline: profile?.isOnline ?? false,
    verificationStatus: profile?.verificationStatus ?? "PENDING",
    profileDraftStatus: profile?.profileDraftStatus ?? "NONE",
    profilePendingReview: Boolean(pendingDraft),
    profileDraftSubmittedAt: profile?.profileDraftSubmittedAt?.toISOString() ?? null,
    profileDraftRejectNote: profile?.profileDraftRejectNote ?? null,
    profileDraftRejectedAt: profile?.profileDraftRejectedAt?.toISOString() ?? null,
    profile: view
      ? formatMeProfileResponse(view, profile!.ratingAvg, profile!.reviewCount)
      : null,
  });
}

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

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const firstFieldMessage = Object.values(flat.fieldErrors)
      .flat()
      .find((msg): msg is string => typeof msg === "string");
    return NextResponse.json(
      { error: firstFieldMessage ?? "Проверьте корректность заполненных полей.", details: flat },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  let normalizedOffers: SpecializationOffer[] | undefined;
  if (payload.specializationOffers !== undefined) {
    normalizedOffers = [];
    for (const row of payload.specializationOffers) {
      const trimmed = row.label.trim();
      if (!trimmed) continue;
      const normalized = normalizeSpecializationOffer({
        label: trimmed,
        hourlyRate: row.hourlyRate,
        lessonsCompleted: row.lessonsCompleted ?? 0,
        drivingDetails: row.drivingDetails,
      });
      const drivingErr = validateDrivingSchoolDetails(
        normalized.drivingDetails,
      );
      if (drivingErr && isAutoInstructorLabel(normalized.label)) {
        return NextResponse.json({ error: drivingErr }, { status: 400 });
      }
      normalizedOffers.push(normalized);
    }
    if (!normalizedOffers.length) {
      return NextResponse.json({ error: "Укажите хотя бы одно направление с ценой." }, { status: 400 });
    }
  }

  const nextCanonSpecs =
    normalizedOffers !== undefined
      ? normalizedOffers.map((o) => o.label)
      : payload.specializations !== undefined
        ? canonicalizeActivityLabels(payload.specializations)
        : undefined;

  let bioForUpdate = payload.bio;
  if (nextCanonSpecs !== undefined && payload.bio !== undefined) {
    const prevForBio = await prisma.instructorProfile.findUnique({
      where: { userId: userId },
      select: { specializations: true },
    });
    if (prevForBio) {
      const synced = syncSyntheticBioLineWithSpecs(
        payload.bio,
        prevForBio.specializations,
        nextCanonSpecs,
      );
      if (synced !== undefined) bioForUpdate = synced;
    }
  }

  /** Пустая обложка в форме: не обнуляем превью, если в галерее есть фото (совпадает с логикой списка инструкторов). */
  let resolvedCoverUpdate: string | null | undefined;
  if (payload.photoUrl !== undefined) {
    const trimmed = payload.photoUrl.trim();
    if (trimmed.length > 0) {
      resolvedCoverUpdate = trimmed;
    } else {
      const prev = await prisma.instructorProfile.findUnique({
        where: { userId: userId },
        select: { photoGallery: true },
      });
      const first = prev?.photoGallery?.find((u) => typeof u === "string" && u.trim());
      resolvedCoverUpdate = first?.trim() ?? null;
    }
  }

  await ensureInstructorProfile(userId);

  const existingProfile = await prisma.instructorProfile.findUnique({
    where: { userId: userId },
    select: {
      verificationStatus: true,
      profileDraft: true,
      profileDraftStatus: true,
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

  if (!existingProfile) {
    return NextResponse.json({ error: "Не удалось создать профиль инструктора" }, { status: 500 });
  }

  try {
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const parsedExistingDraft =
      existingProfile.profileDraftStatus === "PENDING_REVIEW"
        ? parseProfileDraft(existingProfile.profileDraft)
        : null;
    const base =
      parsedExistingDraft ??
      snapshotProfileToDraft(existingProfile, userRow?.name ?? null);
    const patch = buildDraftPatchFromMePayload({
      firstName: payload.firstName,
      lastName: payload.lastName,
      bioForUpdate: payload.bio !== undefined ? bioForUpdate : undefined,
      nextCanonSpecs,
      normalizedOffers,
      payload,
      resolvedCoverUpdate,
    });
    const merged = mergeProfileDraft(base, patch);

    await prisma.instructorProfile.update({
      where: { userId },
      data: {
        profileDraft: merged as Prisma.InputJsonValue,
        profileDraftStatus: "PENDING_REVIEW",
        profileDraftSubmittedAt: new Date(),
        profileDraftRejectNote: null,
        profileDraftRejectedAt: null,
      },
    });

    const view = draftAsProfileView(merged);
    return NextResponse.json({
      profilePendingReview: true,
      profileDraftStatus: "PENDING_REVIEW",
      verificationStatus: existingProfile.verificationStatus,
      profile: formatMeProfileResponse(
        view,
        existingProfile.ratingAvg,
        existingProfile.reviewCount,
      ),
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2022") {
        return NextResponse.json(
          {
            error:
              "Структура базы данных устарела. Выполните prisma db push / перезапустите docker-compose.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: `Ошибка базы данных (${e.code}) при сохранении профиля.` },
        { status: 500 },
      );
    }
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json(
      { error: `Не удалось сохранить профиль: ${message}` },
      { status: 500 },
    );
  }
}
