import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { liveInstructorEmailWhere } from "@/lib/demo-instructor";
import { effectivePhotoGallery } from "@/lib/instructor-profile-photo-draft";
import { prisma } from "@/lib/prisma";
import {
  parseSpecializationOffers,
  resolveHourlyRateForDiscipline,
  resolveLessonsForDiscipline,
} from "@/lib/instructor-specialization-offers";
import { DEFAULT_SKI_RESORT_CENTER, haversineKm } from "@/lib/services/geo";
import {
  canonicalizeActivityLabels,
  resolveInstructorListAvatar,
} from "@/lib/services/instructor-match";
import { activePublishedEventWhere } from "@/lib/services/instructor-event-expiry";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    q: z.string().trim().min(2).max(64).optional(),
    id: z.string().cuid().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    specialization: z.string().trim().max(80).optional(),
    limit: z.coerce.number().int().min(1).max(30).optional().default(20),
  })
  .refine((d) => Boolean(d.q?.length || d.id), {
    message: "Укажите q (имя) или id инструктора",
    path: ["q"],
  });

function normalizeSearchInput(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Одно слово — в имени, био или контакте инструктора. */
function instructorTokenClause(t: string): Prisma.UserWhereInput {
  return {
    OR: [
      { name: { contains: t, mode: "insensitive" } },
      {
        instructorProfile: {
          OR: [
            { bio: { contains: t, mode: "insensitive" } },
            { supportContact: { contains: t, mode: "insensitive" } },
          ],
        },
      },
    ],
  };
}

function buildTextSearchWhere(q: string): Prisma.UserWhereInput {
  const tokens = normalizeSearchInput(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { id: "__instructor_name_search_empty__" };
  }
  return {
    AND: tokens.map((t) => instructorTokenClause(t)),
  };
}

function textMatchesAllTokens(text: string, tokens: string[]): boolean {
  const hay = text.toLowerCase();
  return tokens.every((t) => hay.includes(t.toLowerCase()));
}

/** Имя в тексте мероприятия → инструктор, который его ведёт. */
async function instructorIdsFromPublishedEvents(tokens: string[]): Promise<string[]> {
  if (tokens.length === 0) return [];
  const events = await prisma.instructorEvent.findMany({
    where: activePublishedEventWhere(),
    select: { instructorId: true, title: true, body: true },
    take: 300,
  });
  const ids = new Set<string>();
  for (const ev of events) {
    const blob = `${ev.title}\n${ev.body}`;
    if (textMatchesAllTokens(blob, tokens)) ids.add(ev.instructorId);
  }
  return [...ids];
}

type InstructorListRow = {
  id: string;
  name: string | null;
  taxStatus: import("@prisma/client").InstructorTaxStatus | null;
  image: string | null;
  photoUrl: string | null;
  age: number | null;
  isOnline: boolean;
  ratingAvg: number;
  reviewCount: number;
  languages: string[];
  hourlyRate: number;
  lessonsForDiscipline: number | null;
  specializations: string[];
  lat: number;
  lng: number;
  distanceKm: number;
};

async function loadApprovedInstructors(
  where: Prisma.UserWhereInput,
  limit: number,
) {
  return prisma.user.findMany({
    where: {
      role: "INSTRUCTOR",
      ...liveInstructorEmailWhere,
      instructorProfile: { verificationStatus: "APPROVED" },
      ...where,
    },
    include: { instructorProfile: true },
    take: limit,
    orderBy: [{ instructorProfile: { ratingAvg: "desc" } }, { name: "asc" }],
  });
}

function mapInstructorToListRow(
  u: Awaited<ReturnType<typeof loadApprovedInstructors>>[number],
  originLat: number,
  originLng: number,
  specialization: string | undefined,
): InstructorListRow | null {
  const p = u.instructorProfile;
  if (!p) return null;
  const hasCoords = p.lat != null && p.lng != null;
  const pinLat = hasCoords ? p.lat! : DEFAULT_SKI_RESORT_CENTER.lat;
  const pinLng = hasCoords ? p.lng! : DEFAULT_SKI_RESORT_CENTER.lng;
  const km = haversineKm(originLat, originLng, pinLat, pinLng);

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
    taxStatus: p.taxStatus,
    image: u.image,
    photoUrl: listPhotoUrl,
    age: p.age,
    isOnline: p.isOnline,
    ratingAvg: p.ratingAvg,
    reviewCount: p.reviewCount,
    languages: p.languages,
    hourlyRate: displayRate,
    lessonsForDiscipline,
    specializations: canonicalizeActivityLabels(p.specializations),
    lat: pinLat,
    lng: pinLng,
    distanceKm: Math.round(km * 10) / 10,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { q, id, lat, lng, specialization, limit } = parsed.data;
  const originLat = lat ?? DEFAULT_SKI_RESORT_CENTER.lat;
  const originLng = lng ?? DEFAULT_SKI_RESORT_CENTER.lng;
  const tokens = q ? normalizeSearchInput(q).split(/\s+/).filter(Boolean) : [];

  const eventInstructorIds = q ? await instructorIdsFromPublishedEvents(tokens) : [];

  const matchClauses: Prisma.UserWhereInput[] = [];
  if (id) matchClauses.push({ id });
  if (q) matchClauses.push(buildTextSearchWhere(q));
  if (eventInstructorIds.length) matchClauses.push({ id: { in: eventInstructorIds } });

  if (matchClauses.length === 0) {
    return NextResponse.json({ instructors: [] });
  }

  const instructors = await loadApprovedInstructors({ OR: matchClauses }, limit);

  const rows = instructors
    .map((u) => mapInstructorToListRow(u, originLat, originLng, specialization))
    .filter((x): x is InstructorListRow => x !== null);

  return NextResponse.json(
    { instructors: rows },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
