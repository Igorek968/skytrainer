import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  canonicalizeActivityLabels,
  repairStaleCatalogSyntheticBio,
  resolveInstructorListAvatar,
} from "@/lib/services/instructor-match";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const instructor = await prisma.user.findFirst({
    where: { id, role: "INSTRUCTOR" },
    include: {
      instructorProfile: true,
    },
  });

  if (!instructor?.instructorProfile) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }

  const [completedLessons, lessonsWithHours, recentReviews] = await prisma.$transaction([
    prisma.order.count({
      where: {
        instructorId: id,
        status: "COMPLETED",
      },
    }),
    prisma.order.findMany({
      where: {
        instructorId: id,
        status: "COMPLETED",
      },
      select: {
        lessonStartedAt: true,
        lessonEndedAt: true,
      },
      take: 500,
    }),
    prisma.order.findMany({
      where: {
        instructorId: id,
        status: "COMPLETED",
        clientRating: { not: null },
      },
      select: {
        id: true,
        clientRating: true,
        clientReview: true,
        createdAt: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const taughtHours = lessonsWithHours.reduce((acc, l) => {
    if (!l.lessonStartedAt || !l.lessonEndedAt) return acc;
    const h = (l.lessonEndedAt.getTime() - l.lessonStartedAt.getTime()) / (1000 * 60 * 60);
    return acc + (h > 0 ? h : 0);
  }, 0);

  const gallery = instructor.instructorProfile.photoGallery ?? [];
  /** Та же цепочка, что в `/api/instructors/nearby`: обложка → галерея → аватар учётной записи. */
  const resolvedPhotoUrl = resolveInstructorListAvatar({
    photoUrl: instructor.instructorProfile.photoUrl,
    photoGallery: gallery,
    userImage: instructor.image,
  });

  const canonSpecs = canonicalizeActivityLabels(instructor.instructorProfile.specializations);

  return NextResponse.json(
    {
    instructor: {
      id: instructor.id,
      name: instructor.name,
      image: instructor.image,
      profile: {
        bio: repairStaleCatalogSyntheticBio(instructor.instructorProfile.bio, canonSpecs),
        photoUrl: resolvedPhotoUrl,
        photoGallery: gallery,
        certificationLevel: instructor.instructorProfile.certificationLevel,
        certifications: instructor.instructorProfile.certifications,
        skillLevels: instructor.instructorProfile.skillLevels,
        languages: instructor.instructorProfile.languages,
        specializations: canonSpecs,
        additionalServices: instructor.instructorProfile.additionalServices,
        offeredDurations: instructor.instructorProfile.offeredDurations,
        availabilitySlots: instructor.instructorProfile.availabilitySlots ?? [],
        age: instructor.instructorProfile.age,
        experienceYears: instructor.instructorProfile.experienceYears,
        totalLessons: instructor.instructorProfile.totalLessons,
        cancellationPolicy: instructor.instructorProfile.cancellationPolicy,
        supportContact: instructor.instructorProfile.supportContact,
        legalInfo: instructor.instructorProfile.legalInfo,
        telegramUrl: instructor.instructorProfile.telegramUrl,
        whatsappUrl: instructor.instructorProfile.whatsappUrl,
        instagramUrl: instructor.instructorProfile.instagramUrl,
        videoVisitUrl: instructor.instructorProfile.videoVisitUrl,
        hourlyRate: Number(instructor.instructorProfile.hourlyRate),
        ratingAvg: instructor.instructorProfile.ratingAvg,
        reviewCount: instructor.instructorProfile.reviewCount,
      },
      stats: {
        completedLessons,
        taughtHours: Math.round(taughtHours * 10) / 10,
      },
      achievements: instructor.instructorProfile.achievements,
      reviews: recentReviews.map((r) => ({
        id: r.id,
        rating: r.clientRating,
        text: r.clientReview,
        createdAt: r.createdAt,
        authorName: r.client.name,
      })),
    },
  },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
