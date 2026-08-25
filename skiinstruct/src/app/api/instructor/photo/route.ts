import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { ensureInstructorProfile } from "@/lib/instructor-profile-defaults";
import {
  applyInstructorPhotoUpdate,
  effectivePhotoGallery,
} from "@/lib/instructor-profile-photo-draft";
import { prisma } from "@/lib/prisma";
import { publicUploadDisplaySrc, publicUploadDisplaySrcs, publicUploadStorageUrl } from "@/lib/public-uploads-display";
import { writePublicUpload } from "@/lib/public-uploads";
import { compressUploadedImageBytes } from "@/lib/image-compress";
import { validateUploadedBytes } from "@/lib/upload-validation";

function formatPhotoApiResponse(result: {
  photoUrl: string | null;
  photoGallery: string[];
  profilePendingReview?: boolean;
}) {
  return {
    ...result,
    photoUrl: publicUploadDisplaySrc(result.photoUrl),
    photoGallery: publicUploadDisplaySrcs(result.photoGallery),
  };
}

const MAX_SIZE_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_GALLERY = 5;
const patchSchema = z.object({
  photoGallery: z.array(z.string().min(1)).max(MAX_GALLERY).optional(),
  coverUrl: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Допустимы JPG, PNG, WEBP" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Файл слишком большой. Выберите JPG/PNG — сайт сожмёт его примерно до 1 МБ (длинная сторона до 1600 px)." },
      { status: 400 },
    );
  }

  const raw = Buffer.from(await file.arrayBuffer());
  if (!validateUploadedBytes(file.type, raw)) {
    return NextResponse.json({ error: "Содержимое файла не соответствует формату" }, { status: 400 });
  }

  const { buffer, ext } = await compressUploadedImageBytes(raw, file.type);
  const filename = `${userId}-${randomUUID()}.${ext}`;
  const photoUrl = await writePublicUpload("instructors", filename, buffer);
  await ensureInstructorProfile(userId);
  const [profile, user] = await Promise.all([
    prisma.instructorProfile.findUnique({
      where: { userId: userId },
      select: {
        verificationStatus: true,
        profileDraft: true,
        profileDraftStatus: true,
        photoGallery: true,
        photoUrl: true,
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
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  if (!profile) {
    return NextResponse.json({ error: "Не удалось создать профиль инструктора" }, { status: 500 });
  }
  const { photoGallery: current, photoUrl: currentCover } = effectivePhotoGallery(
    profile,
    user?.name ?? null,
  );
  if (current.length >= MAX_GALLERY) {
    return NextResponse.json(
      { error: `Можно загрузить максимум ${MAX_GALLERY} фото` },
      { status: 400 }
    );
  }

  const nextGallery = [...current, photoUrl];
  const nextCover = currentCover || photoUrl;

  const result = await applyInstructorPhotoUpdate(userId, user?.name ?? null, profile, {
    photoUrl: nextCover,
    photoGallery: nextGallery,
  });

  return NextResponse.json(formatPhotoApiResponse(result));
}

export async function DELETE(req: Request) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const url = new URL(req.url);
  const removeUrl = publicUploadStorageUrl(url.searchParams.get("photoUrl"));

  await ensureInstructorProfile(userId);
  const [profile, user] = await Promise.all([
    prisma.instructorProfile.findUnique({
      where: { userId: userId },
      select: {
        verificationStatus: true,
        profileDraft: true,
        profileDraftStatus: true,
        photoGallery: true,
        photoUrl: true,
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
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  if (!profile) {
    return NextResponse.json({ error: "Не удалось создать профиль инструктора" }, { status: 500 });
  }
  const { photoGallery: current } = effectivePhotoGallery(profile, user?.name ?? null);

  const nextGallery = removeUrl ? current.filter((p) => p !== removeUrl) : [];
  const nextCover = nextGallery[0] ?? null;

  const result = await applyInstructorPhotoUpdate(userId, user?.name ?? null, profile, {
    photoUrl: nextCover,
    photoGallery: nextGallery,
  });

  return NextResponse.json({ ok: true, ...formatPhotoApiResponse(result) });
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

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await ensureInstructorProfile(userId);
  const [profile, user] = await Promise.all([
    prisma.instructorProfile.findUnique({
      where: { userId: userId },
      select: {
        verificationStatus: true,
        profileDraft: true,
        profileDraftStatus: true,
        photoGallery: true,
        photoUrl: true,
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
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  if (!profile) {
    return NextResponse.json({ error: "Не удалось создать профиль инструктора" }, { status: 500 });
  }
  const { photoGallery: current, photoUrl: currentCover } = effectivePhotoGallery(
    profile,
    user?.name ?? null,
  );
  const nextGalleryRaw = parsed.data.photoGallery ?? current;
  const nextGallery = nextGalleryRaw.map((p) => publicUploadStorageUrl(p) ?? p);

  // Ensure instructor can only reorder existing own photos.
  const sameSet =
    nextGallery.length === current.length &&
    nextGallery.every((p) => current.includes(p)) &&
    current.every((p) => nextGallery.includes(p));
  if (!sameSet && parsed.data.photoGallery) {
    return NextResponse.json({ error: "Некорректный список фото" }, { status: 400 });
  }

  let coverUrl = parsed.data.coverUrl
    ? (publicUploadStorageUrl(parsed.data.coverUrl) ?? parsed.data.coverUrl)
    : (currentCover ?? null);
  if (coverUrl && !nextGallery.includes(coverUrl)) {
    coverUrl = nextGallery[0] ?? null;
  }
  if (!coverUrl && nextGallery.length) {
    coverUrl = nextGallery[0];
  }

  const result = await applyInstructorPhotoUpdate(userId, user?.name ?? null, profile, {
    photoUrl: coverUrl,
    photoGallery: nextGallery,
  });

  return NextResponse.json(formatPhotoApiResponse(result));
}
