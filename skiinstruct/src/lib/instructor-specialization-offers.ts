import {
  canonicalizeAutoInstructorLabel,
  isAutoInstructorLabel,
  normalizeDrivingSchoolDetails,
  parseDrivingSchoolDetails,
  type DrivingSchoolOfferDetails,
} from "@/lib/auto-instructor-offer";
import {
  activityLabelSortKey,
  canonicalizeActivityLabel,
  canonicalizeActivityLabels,
} from "@/lib/services/instructor-match";

export type { DrivingSchoolOfferDetails };

export type SpecializationOffer = {
  label: string;
  hourlyRate: number;
  lessonsCompleted: number;
  drivingDetails?: DrivingSchoolOfferDetails;
};

export function normalizeInstructorActivityLabelInput(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!trimmed) return "";
  return (
    canonicalizeActivityLabel(trimmed) ??
    canonicalizeAutoInstructorLabel(trimmed) ??
    trimmed
  );
}

export function emptySpecializationOffer(hourlyRate = 2500): SpecializationOffer {
  return { label: "", hourlyRate, lessonsCompleted: 0 };
}

/** Строки с заполненным названием — для сохранения и валидации. */
export function filledSpecializationOffers(offers: SpecializationOffer[]): SpecializationOffer[] {
  const seen = new Set<string>();
  const result: SpecializationOffer[] = [];
  for (const row of offers) {
    const label = normalizeInstructorActivityLabelInput(row.label);
    if (!label) continue;
    const key = activityLabelSortKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(
      normalizeSpecializationOffer({
        ...row,
        label,
        lessonsCompleted: row.lessonsCompleted ?? 0,
      }),
    );
  }
  return result;
}

export function ensureSpecializationOfferRows(
  offers: SpecializationOffer[],
  defaultRate = 2500,
): SpecializationOffer[] {
  return offers.length ? offers : [emptySpecializationOffer(defaultRate)];
}

function isOfferRowCore(v: unknown): v is Pick<SpecializationOffer, "label" | "hourlyRate" | "lessonsCompleted"> {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.label === "string" &&
    typeof o.hourlyRate === "number" &&
    Number.isFinite(o.hourlyRate) &&
    typeof o.lessonsCompleted === "number" &&
    Number.isFinite(o.lessonsCompleted)
  );
}

export function normalizeSpecializationOffer(row: SpecializationOffer): SpecializationOffer {
  const trimmed = row.label.trim();
  const label =
    canonicalizeActivityLabel(trimmed) ??
    canonicalizeAutoInstructorLabel(trimmed) ??
    trimmed;
  const base: SpecializationOffer = {
    label,
    hourlyRate: Math.min(100_000, Math.max(500, Math.round(row.hourlyRate))),
    lessonsCompleted: Math.max(0, Math.round(row.lessonsCompleted)),
  };
  if (!isAutoInstructorLabel(label)) return base;
  return {
    ...base,
    drivingDetails: normalizeDrivingSchoolDetails(
      row.drivingDetails ?? parseDrivingSchoolDetails((row as { drivingDetails?: unknown }).drivingDetails),
    ),
  };
}

/** Читает JSON из профиля или собирает из legacy specializations + hourlyRate. */
export function parseSpecializationOffers(
  raw: unknown,
  fallbackHourlyRate: number,
  legacySpecializations: string[],
): SpecializationOffer[] {
  const fallbackRate = Number.isFinite(fallbackHourlyRate) && fallbackHourlyRate >= 500 ? fallbackHourlyRate : 2500;

  if (Array.isArray(raw)) {
    const parsed: SpecializationOffer[] = [];
    for (const row of raw) {
      if (!isOfferRowCore(row)) continue;
      const trimmed = row.label.trim();
      if (!trimmed) continue;
      parsed.push(
        normalizeSpecializationOffer({
          label: trimmed,
          hourlyRate: row.hourlyRate,
          lessonsCompleted: row.lessonsCompleted,
          drivingDetails: parseDrivingSchoolDetails(
            (row as { drivingDetails?: unknown }).drivingDetails,
          ),
        }),
      );
    }
    if (parsed.length) return dedupeOffers(parsed);
  }

  const labels = canonicalizeActivityLabels(legacySpecializations);
  return labels.map((label) => ({
    label,
    hourlyRate: fallbackRate,
    lessonsCompleted: 0,
  }));
}

function dedupeOffers(offers: SpecializationOffer[]): SpecializationOffer[] {
  const map = new Map<string, SpecializationOffer>();
  for (const o of offers) {
    map.set(o.label, o);
  }
  return [...map.values()].sort((a, b) =>
    activityLabelSortKey(a.label).localeCompare(activityLabelSortKey(b.label), "ru"),
  );
}

export function offersFromLabels(
  labels: string[],
  prev: SpecializationOffer[],
  defaultRate: number,
): SpecializationOffer[] {
  const canon = canonicalizeActivityLabels(labels);
  const prevMap = new Map(prev.map((o) => [o.label, o]));
  const rate = defaultRate >= 500 ? defaultRate : 2500;
  return canon.map((label) => {
    const existing = prevMap.get(label);
    if (existing) return normalizeSpecializationOffer(existing);
    const created: SpecializationOffer = {
      label,
      hourlyRate: rate,
      lessonsCompleted: 0,
    };
    if (isAutoInstructorLabel(label)) {
      created.drivingDetails = normalizeDrivingSchoolDetails(undefined);
    }
    return created;
  });
}

export function resolveHourlyRateForDiscipline(
  offers: SpecializationOffer[],
  disciplineRaw: string | null | undefined,
  fallbackHourlyRate: number,
): number {
  const label = disciplineRaw ? canonicalizeActivityLabel(disciplineRaw) : null;
  if (label) {
    const hit = offers.find((o) => o.label === label);
    if (hit) return hit.hourlyRate;
  }
  if (offers.length) return Math.min(...offers.map((o) => o.hourlyRate));
  return fallbackHourlyRate;
}

export function resolveLessonsForDiscipline(
  offers: SpecializationOffer[],
  disciplineRaw: string | null | undefined,
  fallbackTotal: number | null | undefined,
): number | null {
  const label = disciplineRaw ? canonicalizeActivityLabel(disciplineRaw) : null;
  if (label) {
    const hit = offers.find((o) => o.label === label);
    if (hit) return hit.lessonsCompleted;
  }
  if (offers.length) return offers.reduce((s, o) => s + o.lessonsCompleted, 0);
  return fallbackTotal ?? null;
}

export function syncProfileHourlyRateFromOffers(offers: SpecializationOffer[], current: number): number {
  if (!offers.length) return current;
  return Math.min(...offers.map((o) => o.hourlyRate));
}

export function parseDisciplineFromOrderNotes(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  const m = /(?:^|\n)Дисциплина:\s*(.+)$/im.exec(notes);
  return m?.[1]?.trim() ?? null;
}

import { prisma } from "@/lib/prisma";

export async function incrementOfferLessonsOnOrderComplete(
  instructorUserId: string,
  disciplineLabel: string | null,
): Promise<void> {
  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: instructorUserId },
    select: {
      specializationOffers: true,
      specializations: true,
      hourlyRate: true,
    },
  });
  if (!profile) return;

  const canon =
    (disciplineLabel ? canonicalizeActivityLabel(disciplineLabel) : null) ??
    null;
  if (!canon) return;

  const offers = parseSpecializationOffers(
    profile.specializationOffers,
    Number(profile.hourlyRate),
    profile.specializations,
  );
  const idx = offers.findIndex((o) => o.label === canon);
  if (idx < 0) {
    offers.push({
      label: canon,
      hourlyRate: Number(profile.hourlyRate) || 2500,
      lessonsCompleted: 1,
    });
  } else {
    offers[idx] = { ...offers[idx], lessonsCompleted: offers[idx].lessonsCompleted + 1 };
  }

  const totalLessons = offers.reduce((s, o) => s + o.lessonsCompleted, 0);

  await prisma.instructorProfile.update({
    where: { userId: instructorUserId },
    data: {
      specializationOffers: offers,
      specializations: offers.map((o) => o.label),
      totalLessons,
      hourlyRate: syncProfileHourlyRateFromOffers(offers, Number(profile.hourlyRate)),
    },
  });
}
