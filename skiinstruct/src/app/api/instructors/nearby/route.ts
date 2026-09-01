import { NextResponse } from "next/server";
import { z } from "zod";

import { effectivePhotoGallery } from "@/lib/instructor-profile-photo-draft";
import { prisma } from "@/lib/prisma";
import {
  parseSpecializationOffers,
  resolveHourlyRateForDiscipline,
  resolveLessonsForDiscipline,
} from "@/lib/instructor-specialization-offers";
import {
  canonicalizeActivityLabels,
  durationLabelMatches,
  instructorMatchesAvailability,
  normalizeText,
  resolveInstructorListAvatar,
  skillLevelMatches,
  specializationMatches,
  utcCalendarWeekdaysInclusive,
} from "@/lib/services/instructor-match";
import { liveInstructorEmailWhere } from "@/lib/demo-instructor";
import { DEFAULT_SKI_RESORT_CENTER, haversineKm } from "@/lib/services/geo";
import { findInstructorScheduleConflict } from "@/lib/services/instructor-schedule";

/** Список инструкторов меняется при редактировании профиля — не кэшируем ответ CDN/браузером. */
export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().min(0.5).max(50).optional().default(5),
    skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
    languagePref: z.string().trim().min(1).max(64).optional(),
    duration: z.enum(["ONE_HOUR", "TWO_HOURS", "HALF_DAY", "FULL_DAY"]).optional(),
    specialization: z.string().trim().min(1).max(80).optional(),
    lessonDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    lessonEndDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    lessonDays: z.coerce.number().int().min(1).max(30).optional().default(1),
    lessonStartTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    lessonEndTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    lessonTimeZoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).optional(),
    /** Показать одобренных инструкторов, даже офлайн; слоты по дням недели не фильтруем. */
    includeOffline: z
      .enum(["0", "1", "true", "false"])
      .optional()
      .transform((v) => v === "1" || v === "true"),
  })
  .refine((d) => d.includeOffline === true || d.lessonDate != null, {
    message: "lessonDate обязательна, если не включён режим «офлайн / запись на дату»",
    path: ["lessonDate"],
  });

const SKILL_LEVEL_TO_LABEL: Record<string, string> = {
  BEGINNER: "Для начинающих",
  INTERMEDIATE: "Средний",
  ADVANCED: "Продвинутый",
};
const DURATION_TO_LABEL: Record<string, string> = {
  ONE_HOUR: "1 ч",
  TWO_HOURS: "2 ч",
  HALF_DAY: "Полдня",
  FULL_DAY: "День",
};

/** Онлайн-инструкторы: шире радиус (курорт/агломерация); офлайн — radiusKm из запроса. */
const ONLINE_DISCOVERY_RADIUS_KM = 100;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    lat,
    lng,
    radiusKm,
    skillLevel,
    languagePref,
    duration,
    specialization,
    lessonDate,
    lessonEndDate,
    lessonDays,
    includeOffline,
    lessonStartTime,
    lessonEndTime,
    lessonTimeZoneOffsetMinutes,
  } = parsed.data;

  const skillLabel = skillLevel ? SKILL_LEVEL_TO_LABEL[skillLevel] : null;
  const durationLabel = duration ? DURATION_TO_LABEL[duration] : null;
  const languageNeedle = normalizeText(languagePref ?? "");
  const specializationNeedle = normalizeText(specialization ?? "");

  const requestedDays =
    includeOffline || !lessonDate
      ? null
      : utcCalendarWeekdaysInclusive(lessonDate, lessonEndDate, lessonDays);

  const instructors = await prisma.user.findMany({
    where: {
      role: "INSTRUCTOR",
      ...liveInstructorEmailWhere,
      suspendedAt: null,
      instructorProfile: {
        verificationStatus: "APPROVED",
        ...(includeOffline
          ? {}
          : {
              isOnline: true,
            }),
      },
    },
    include: {
      instructorProfile: true,
    },
  });

  const withDistance = instructors
    .map((u) => {
      const p = u.instructorProfile;
      if (!p) return null;
      const hasCoords = p.lat != null && p.lng != null;
      const pinLat = hasCoords ? p.lat! : DEFAULT_SKI_RESORT_CENTER.lat;
      const pinLng = hasCoords ? p.lng! : DEFAULT_SKI_RESORT_CENTER.lng;
      const km = haversineKm(lat, lng, pinLat, pinLng);

      const hasAvailabilityForSelectedDate = instructorMatchesAvailability(
        p.availabilitySlots,
        requestedDays,
        includeOffline,
        p.isOnline,
      );

      const hasSkillLevel = skillLevelMatches(p.skillLevels, skillLabel);

      const hasDuration = durationLabelMatches(p.offeredDurations, durationLabel);

      const hasLanguage =
        languageNeedle.length > 0
          ? p.languages.length === 0 ||
            p.languages.some((lang) => normalizeText(lang) === languageNeedle)
          : true;

      const hasSpecialization =
        specializationNeedle.length > 0 ? specializationMatches(p.specializations, specialization ?? "") : true;

      const effectivePhotos = effectivePhotoGallery(p, u.name);
      const listPhotoUrl = resolveInstructorListAvatar({
        photoUrl: effectivePhotos.photoUrl,
        photoGallery: effectivePhotos.photoGallery,
        userImage: u.image,
      });

      const offers = parseSpecializationOffers(
        p.specializationOffers,
        Number(p.hourlyRate),
        p.specializations,
      );
      const displayRate = resolveHourlyRateForDiscipline(
        offers,
        specialization ?? null,
        Number(p.hourlyRate),
      );
      const lessonsForDiscipline = resolveLessonsForDiscipline(
        offers,
        specialization ?? null,
        p.totalLessons,
      );

      return {
        id: u.id,
        name: u.name,
        nickname: u.nickname,
        profileSlug: u.profileSlug,
        taxStatus: p.taxStatus,
        image: u.image,
        photoUrl: listPhotoUrl,
        age: p.age,
        isOnline: p.isOnline,
        workDistrict: p.workDistrict,
        ratingAvg: p.ratingAvg,
        reviewCount: p.reviewCount,
        languages: p.languages,
        hourlyRate: displayRate,
        lessonsForDiscipline,
        specializations: canonicalizeActivityLabels(p.specializations),
        lat: pinLat,
        lng: pinLng,
        distanceKm: Math.round(km * 10) / 10,
        hasAvailabilityForSelectedDate,
        hasSkillLevel,
        hasDuration,
        hasLanguage,
        hasSpecialization,
      };
    })
    .filter(
      (x): x is NonNullable<typeof x> =>
        x !== null &&
        (includeOffline ||
          x.distanceKm <= radiusKm ||
          (x.isOnline && x.distanceKm <= ONLINE_DISCOVERY_RADIUS_KM)) &&
        x.hasAvailabilityForSelectedDate &&
        x.hasSkillLevel &&
        x.hasDuration &&
        x.hasLanguage &&
        x.hasSpecialization,
    )
    .sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      const dist = a.distanceKm - b.distanceKm;
      if (Math.abs(dist) > 0.3) return dist;
      const rating = b.ratingAvg - a.ratingAvg;
      if (rating !== 0) return rating;
      return b.reviewCount - a.reviewCount;
    });

  let instructorsOut = withDistance.map(
    ({
      hasAvailabilityForSelectedDate: _unused,
      hasSkillLevel: _unused2,
      hasDuration: _unused3,
      hasLanguage: _unused4,
      hasSpecialization: _unused5,
      ...rest
    }) => rest,
  );

  if (
    lessonDate &&
    lessonStartTime &&
    lessonEndTime &&
    duration
  ) {
    const available: typeof instructorsOut = [];
    for (const instr of instructorsOut) {
      const conflict = await findInstructorScheduleConflict({
        instructorId: instr.id,
        lessonDate,
        lessonEndDate: lessonEndDate ?? lessonDate,
        lessonStartTime,
        lessonEndTime,
        duration,
        lessonTimeZoneOffsetMinutes: lessonTimeZoneOffsetMinutes ?? 0,
      });
      if (!conflict) available.push(instr);
    }
    instructorsOut = available;
  }

  return NextResponse.json(
    { instructors: instructorsOut },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
