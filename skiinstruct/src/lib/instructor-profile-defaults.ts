import type { InstructorProfile, Prisma } from "@prisma/client";

import { AGENCY_OFFER_VERSION } from "@/lib/legal-config";
import { offersFromLabels } from "@/lib/instructor-specialization-offers";
import { prisma } from "@/lib/prisma";
import { INSTRUCTOR_ACTIVITY_LABELS } from "@/lib/services/instructor-match";

export const DEFAULT_SKILL_LEVELS = [
  "Для начинающих",
  "Средний",
  "Продвинутый",
] as const;

export const DEFAULT_LANGUAGES = ["Русский"] as const;

export const DEFAULT_OFFERED_DURATIONS = ["1 ч", "1.5 ч", "2 ч", "Полдня"] as const;

export const DEFAULT_ADDITIONAL_SERVICES = [
  "Видеоразбор техники",
  "Фотосъёмка на склоне",
] as const;

export const DEFAULT_PLACEHOLDER_BIO =
  "Заполните описание опыта, сертификаты и с кем вы работаете (не менее 20 символов).";

export type InstructorProfileSeedInput = {
  bio?: string;
  hourlyRate?: number;
  specializations?: string[];
  achievements?: string[];
  certificationLevel?: string;
  certifications?: string[];
  languages?: string[];
  skillLevels?: string[];
  additionalServices?: string[];
  offeredDurations?: string[];
  verificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  isOnline?: boolean;
  agencyOfferAcceptedAt?: Date | null;
  agencyOfferVersion?: string | null;
  taxStatus?: "SELF_EMPLOYED" | "IP" | null;
  inn?: string | null;
  passportSeries?: string | null;
  passportNumber?: string | null;
  passportIssuedAt?: Date | null;
  passportDepartmentCode?: string | null;
};

export type AvailabilitySlotRow = {
  day: number;
  from: string;
  to: string;
  busy: boolean;
};

/** Слоты на сегодня и два следующих дня — как в демо-сидах. */
export function defaultAvailabilitySlots(): AvailabilitySlotRow[] {
  const baseDay = new Date().getDay();
  return [0, 1, 2].flatMap((offset) => {
    const day = (baseDay + offset) % 7;
    return [{ day, from: "09:00", to: "16:00", busy: false }];
  });
}

export function buildInstructorProfileCreateData(
  input: InstructorProfileSeedInput = {},
): Omit<Prisma.InstructorProfileUncheckedCreateInput, "userId"> {
  const hourlyRate = input.hourlyRate ?? 3000;
  const specializations =
    input.specializations?.length && input.specializations[0]
      ? input.specializations
      : [INSTRUCTOR_ACTIVITY_LABELS[0]];
  const certificationLevel = input.certificationLevel?.trim() ?? "";
  const certifications =
    input.certifications?.length
      ? input.certifications
      : certificationLevel
        ? [certificationLevel]
        : [];

  return {
    bio: input.bio?.trim() || DEFAULT_PLACEHOLDER_BIO,
    certificationLevel: certificationLevel || null,
    certifications,
    skillLevels: [...(input.skillLevels ?? DEFAULT_SKILL_LEVELS)],
    languages: [...(input.languages ?? DEFAULT_LANGUAGES)],
    specializations,
    specializationOffers: offersFromLabels(specializations, [], hourlyRate),
    additionalServices: [...(input.additionalServices ?? DEFAULT_ADDITIONAL_SERVICES)],
    offeredDurations: [...(input.offeredDurations ?? DEFAULT_OFFERED_DURATIONS)],
    availabilitySlots: defaultAvailabilitySlots(),
    hourlyRate,
    achievements: input.achievements ?? [],
    verificationStatus: input.verificationStatus ?? "PENDING",
    isOnline: input.isOnline ?? false,
    agencyOfferAcceptedAt: input.agencyOfferAcceptedAt ?? null,
    agencyOfferVersion: input.agencyOfferVersion ?? AGENCY_OFFER_VERSION,
    taxStatus: input.taxStatus ?? null,
    inn: input.inn?.trim() || null,
    passportSeries: input.passportSeries?.trim() || null,
    passportNumber: input.passportNumber?.trim() || null,
    passportIssuedAt: input.passportIssuedAt ?? null,
    passportDepartmentCode: input.passportDepartmentCode?.trim() || null,
  };
}

function hasAvailabilitySlots(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0;
}

function hasSpecializationOffers(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0;
}

/** Дозаполняет устаревшие или неполные анкеты без перезаписи уже заполненных полей. */
export function buildProfileBackfillData(
  profile: InstructorProfile,
): Prisma.InstructorProfileUpdateInput {
  const data: Prisma.InstructorProfileUpdateInput = {};
  const hourlyRate = Number(profile.hourlyRate);

  if (!profile.languages.length) {
    data.languages = [...DEFAULT_LANGUAGES];
  }
  if (!profile.skillLevels.length) {
    data.skillLevels = [...DEFAULT_SKILL_LEVELS];
  }
  if (!profile.offeredDurations.length) {
    data.offeredDurations = [...DEFAULT_OFFERED_DURATIONS];
  }
  if (!profile.additionalServices.length) {
    data.additionalServices = [...DEFAULT_ADDITIONAL_SERVICES];
  }
  if (!hasAvailabilitySlots(profile.availabilitySlots)) {
    data.availabilitySlots = defaultAvailabilitySlots();
  }

  const specs = profile.specializations.length
    ? profile.specializations
    : [INSTRUCTOR_ACTIVITY_LABELS[0]];
  if (!profile.specializations.length) {
    data.specializations = specs;
  }
  if (!hasSpecializationOffers(profile.specializationOffers)) {
    data.specializationOffers = offersFromLabels(specs, [], hourlyRate);
  }

  if (!profile.bio?.trim()) {
    data.bio = DEFAULT_PLACEHOLDER_BIO;
  }

  const certLevel = profile.certificationLevel?.trim() ?? "";
  if (!profile.certifications.length && certLevel) {
    data.certifications = [certLevel];
  }

  return data;
}

/** Создаёт или дозаполняет анкету инструктора единым набором полей. */
export async function ensureInstructorProfile(
  userId: string,
  partial?: InstructorProfileSeedInput,
): Promise<InstructorProfile> {
  const existing = await prisma.instructorProfile.findUnique({ where: { userId } });
  if (!existing) {
    return prisma.instructorProfile.create({
      data: {
        userId,
        ...buildInstructorProfileCreateData(partial),
      },
    });
  }

  const backfill = buildProfileBackfillData(existing);
  if (Object.keys(backfill).length === 0) {
    return existing;
  }

  return prisma.instructorProfile.update({
    where: { userId },
    data: backfill,
  });
}

export async function backfillAllInstructorProfiles(): Promise<{
  totalInstructors: number;
  created: number;
  updated: number;
}> {
  const instructors = await prisma.user.findMany({
    where: { role: "INSTRUCTOR" },
    select: { id: true },
  });

  let created = 0;
  let updated = 0;

  for (const { id } of instructors) {
    const before = await prisma.instructorProfile.findUnique({ where: { userId: id } });
    const after = await ensureInstructorProfile(id);
    if (!before) {
      created += 1;
    } else if (after.updatedAt.getTime() !== before.updatedAt.getTime()) {
      updated += 1;
    }
  }

  return { totalInstructors: instructors.length, created, updated };
}
