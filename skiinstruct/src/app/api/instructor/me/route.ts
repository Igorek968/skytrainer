import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  canonicalizeActivityLabels,
  repairStaleCatalogSyntheticBio,
  syncSyntheticBioLineWithSpecs,
} from "@/lib/services/instructor-match";

const updateSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  bio: z.string().max(2000).optional(),
  certificationLevel: z.string().max(120).optional(),
  certifications: z.array(z.string().min(1).max(80)).max(12).optional(),
  skillLevels: z.array(z.string().min(1).max(40)).max(8).optional(),
  languages: z.array(z.string().min(1).max(40)).max(12).optional(),
  specializations: z.array(z.string().min(1).max(80)).max(12).optional(),
  additionalServices: z.array(z.string().min(1).max(80)).max(12).optional(),
  offeredDurations: z.array(z.string().min(1).max(30)).max(10).optional(),
  achievements: z.array(z.string().min(1).max(200)).max(20).optional(),
  experienceYears: z.number().int().min(0).max(80).optional(),
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
  telegramUrl: z.string().url().max(1000).or(z.literal("")).optional(),
  whatsappUrl: z.string().url().max(1000).or(z.literal("")).optional(),
  instagramUrl: z.string().url().max(1000).or(z.literal("")).optional(),
  videoVisitUrl: z.string().url().max(1000).or(z.literal("")).optional(),
  hourlyRate: z.number().min(500).max(100000).optional(),
  photoUrl: z
    .union([
      z.string().url().max(1000),
      z.string().regex(/^\/uploads\/.*/),
      z.literal(""),
    ])
    .optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    }),
    prisma.instructorProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        isOnline: true,
        bio: true,
        certificationLevel: true,
        certifications: true,
        skillLevels: true,
        languages: true,
        specializations: true,
        additionalServices: true,
        offeredDurations: true,
        achievements: true,
        experienceYears: true,
        totalLessons: true,
        age: true,
        availabilitySlots: true,
        cancellationPolicy: true,
        supportContact: true,
        legalInfo: true,
        telegramUrl: true,
        whatsappUrl: true,
        instagramUrl: true,
        videoVisitUrl: true,
        hourlyRate: true,
        photoUrl: true,
        photoGallery: true,
        ratingAvg: true,
        reviewCount: true,
      },
    }),
  ]);
  const [firstName = "", ...restName] = (user?.name ?? "").trim().split(/\s+/).filter(Boolean);
  const lastName = restName.join(" ");

  const canonSpecsForResponse = profile
    ? canonicalizeActivityLabels(profile.specializations)
    : [];

  return NextResponse.json({
    isOnline: profile?.isOnline ?? false,
    profile: profile
      ? {
          firstName,
          lastName,
          bio: repairStaleCatalogSyntheticBio(profile.bio, canonSpecsForResponse),
          certificationLevel: profile.certificationLevel ?? "",
          certifications: profile.certifications,
          skillLevels: profile.skillLevels,
          languages: profile.languages,
          specializations: canonSpecsForResponse,
          additionalServices: profile.additionalServices,
          offeredDurations: profile.offeredDurations,
          achievements: profile.achievements,
          experienceYears: profile.experienceYears ?? null,
          totalLessons: profile.totalLessons ?? null,
          age: profile.age ?? null,
          availabilitySlots: profile.availabilitySlots ?? [],
          cancellationPolicy: profile.cancellationPolicy ?? "",
          supportContact: profile.supportContact ?? "",
          legalInfo: profile.legalInfo ?? "",
          telegramUrl: profile.telegramUrl ?? "",
          whatsappUrl: profile.whatsappUrl ?? "",
          instagramUrl: profile.instagramUrl ?? "",
          videoVisitUrl: profile.videoVisitUrl ?? "",
          hourlyRate: Number(profile.hourlyRate),
          photoUrl: profile.photoUrl ?? "",
          photoGallery: profile.photoGallery,
          ratingAvg: profile.ratingAvg,
          reviewCount: profile.reviewCount,
        }
      : null,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const nextCanonSpecs =
    payload.specializations !== undefined
      ? canonicalizeActivityLabels(payload.specializations)
      : undefined;

  let bioForUpdate = payload.bio;
  if (nextCanonSpecs !== undefined && payload.bio !== undefined) {
    const prevForBio = await prisma.instructorProfile.findUnique({
      where: { userId: session.user.id },
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
        where: { userId: session.user.id },
        select: { photoGallery: true },
      });
      const first = prev?.photoGallery?.find((u) => typeof u === "string" && u.trim());
      resolvedCoverUpdate = first?.trim() ?? null;
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (payload.firstName !== undefined || payload.lastName !== undefined) {
        const first = (payload.firstName ?? "").trim();
        const last = (payload.lastName ?? "").trim();
        const fullName = [first, last].filter(Boolean).join(" ");
        await tx.user.update({
          where: { id: session.user.id },
          data: { name: fullName || null },
        });
      }

      return tx.instructorProfile.update({
        where: { userId: session.user.id },
        data: {
          ...(payload.bio !== undefined ? { bio: bioForUpdate } : {}),
          ...(payload.certificationLevel !== undefined
            ? { certificationLevel: payload.certificationLevel }
            : {}),
          ...(payload.certifications !== undefined ? { certifications: payload.certifications } : {}),
          ...(payload.skillLevels !== undefined ? { skillLevels: payload.skillLevels } : {}),
          ...(payload.languages !== undefined ? { languages: payload.languages } : {}),
          ...(nextCanonSpecs !== undefined ? { specializations: nextCanonSpecs } : {}),
          ...(payload.additionalServices !== undefined
            ? { additionalServices: payload.additionalServices }
            : {}),
          ...(payload.offeredDurations !== undefined
            ? { offeredDurations: payload.offeredDurations }
            : {}),
          ...(payload.achievements !== undefined ? { achievements: payload.achievements } : {}),
          ...(payload.experienceYears !== undefined
            ? { experienceYears: payload.experienceYears }
            : {}),
          ...(payload.totalLessons !== undefined ? { totalLessons: payload.totalLessons } : {}),
          ...(payload.age !== undefined ? { age: payload.age } : {}),
          ...(payload.availabilitySlots !== undefined
            ? { availabilitySlots: payload.availabilitySlots }
            : {}),
          ...(payload.cancellationPolicy !== undefined
            ? { cancellationPolicy: payload.cancellationPolicy }
            : {}),
          ...(payload.supportContact !== undefined ? { supportContact: payload.supportContact } : {}),
          ...(payload.legalInfo !== undefined ? { legalInfo: payload.legalInfo } : {}),
          ...(payload.telegramUrl !== undefined
            ? { telegramUrl: payload.telegramUrl || null }
            : {}),
          ...(payload.whatsappUrl !== undefined
            ? { whatsappUrl: payload.whatsappUrl || null }
            : {}),
          ...(payload.instagramUrl !== undefined
            ? { instagramUrl: payload.instagramUrl || null }
            : {}),
          ...(payload.videoVisitUrl !== undefined
            ? { videoVisitUrl: payload.videoVisitUrl || null }
            : {}),
          ...(payload.hourlyRate !== undefined ? { hourlyRate: payload.hourlyRate } : {}),
          ...(resolvedCoverUpdate !== undefined ? { photoUrl: resolvedCoverUpdate } : {}),
        },
        select: {
          bio: true,
          certificationLevel: true,
          certifications: true,
          skillLevels: true,
          languages: true,
          specializations: true,
          additionalServices: true,
          offeredDurations: true,
          achievements: true,
          experienceYears: true,
          totalLessons: true,
          age: true,
          availabilitySlots: true,
          cancellationPolicy: true,
          supportContact: true,
          legalInfo: true,
          telegramUrl: true,
          whatsappUrl: true,
          instagramUrl: true,
          videoVisitUrl: true,
          hourlyRate: true,
          photoUrl: true,
          photoGallery: true,
        },
      });
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });
    const [updatedUserFirstName = "", ...updatedRestName] = (updatedUser?.name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const canonAfterSave = canonicalizeActivityLabels(updated.specializations);

    return NextResponse.json({
      profile: {
        firstName: updatedUserFirstName,
        lastName: updatedRestName.join(" "),
        bio: repairStaleCatalogSyntheticBio(updated.bio, canonAfterSave),
        certificationLevel: updated.certificationLevel ?? "",
        certifications: updated.certifications,
        skillLevels: updated.skillLevels,
        languages: updated.languages,
        specializations: canonAfterSave,
        additionalServices: updated.additionalServices,
        offeredDurations: updated.offeredDurations,
        achievements: updated.achievements,
        experienceYears: updated.experienceYears ?? null,
        totalLessons: updated.totalLessons ?? null,
        age: updated.age ?? null,
        availabilitySlots: updated.availabilitySlots ?? [],
        cancellationPolicy: updated.cancellationPolicy ?? "",
        supportContact: updated.supportContact ?? "",
        legalInfo: updated.legalInfo ?? "",
        telegramUrl: updated.telegramUrl ?? "",
        whatsappUrl: updated.whatsappUrl ?? "",
        instagramUrl: updated.instagramUrl ?? "",
        videoVisitUrl: updated.videoVisitUrl ?? "",
        hourlyRate: Number(updated.hourlyRate),
        photoUrl: updated.photoUrl ?? "",
        photoGallery: updated.photoGallery,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // Most frequent after schema changes when db:push/migrate was not applied.
      if (e.code === "P2022") {
        return NextResponse.json(
          {
            error:
              "Структура базы данных устарела. Выполните prisma db push / перезапустите docker-compose.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Ошибка базы данных (${e.code}) при сохранении профиля.` },
        { status: 500 }
      );
    }
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json(
      { error: `Не удалось сохранить профиль: ${message}` },
      { status: 500 }
    );
  }
}
