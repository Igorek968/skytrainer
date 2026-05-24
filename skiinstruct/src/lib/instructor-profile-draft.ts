import { Prisma } from "@prisma/client";

import {
  parseSpecializationOffers,
  syncProfileHourlyRateFromOffers,
  type SpecializationOffer,
} from "@/lib/instructor-specialization-offers";
import { canonicalizeActivityLabels } from "@/lib/services/instructor-match";

export type InstructorProfileDraftPayload = {
  firstName?: string;
  lastName?: string;
  bio?: string | null;
  certificationLevel?: string | null;
  certifications?: string[];
  skillLevels?: string[];
  languages?: string[];
  specializations?: string[];
  specializationOffers?: SpecializationOffer[];
  additionalServices?: string[];
  offeredDurations?: string[];
  achievements?: string[];
  experienceYears?: number | null;
  totalLessons?: number | null;
  age?: number | null;
  availabilitySlots?: Prisma.JsonValue;
  cancellationPolicy?: string | null;
  supportContact?: string | null;
  legalInfo?: string | null;
  videoVisitUrl?: string | null;
  hourlyRate?: number;
  photoUrl?: string | null;
  photoGallery?: string[];
};

export function parseProfileDraft(raw: unknown): InstructorProfileDraftPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as InstructorProfileDraftPayload;
}

type ProfileRow = {
  bio: string | null;
  certificationLevel: string | null;
  certifications: string[];
  skillLevels: string[];
  languages: string[];
  specializations: string[];
  specializationOffers: unknown;
  additionalServices: string[];
  offeredDurations: string[];
  achievements: string[];
  experienceYears: number | null;
  totalLessons: number | null;
  age: number | null;
  availabilitySlots: unknown;
  cancellationPolicy: string | null;
  supportContact: string | null;
  legalInfo: string | null;
  videoVisitUrl: string | null;
  hourlyRate: unknown;
  photoUrl: string | null;
  photoGallery: string[];
};

export function snapshotProfileToDraft(
  profile: ProfileRow,
  userName: string | null,
): InstructorProfileDraftPayload {
  const [firstName = "", ...rest] = (userName ?? "").trim().split(/\s+/).filter(Boolean);
  const offers = parseSpecializationOffers(
    profile.specializationOffers,
    Number(profile.hourlyRate),
    profile.specializations,
  );
  return {
    firstName,
    lastName: rest.join(" "),
    bio: profile.bio,
    certificationLevel: profile.certificationLevel,
    certifications: [...profile.certifications],
    skillLevels: [...profile.skillLevels],
    languages: [...profile.languages],
    specializations: canonicalizeActivityLabels(profile.specializations),
    specializationOffers: offers,
    additionalServices: [...profile.additionalServices],
    offeredDurations: [...profile.offeredDurations],
    achievements: [...profile.achievements],
    experienceYears: profile.experienceYears,
    totalLessons: profile.totalLessons,
    age: profile.age,
    availabilitySlots: profile.availabilitySlots as Prisma.JsonValue,
    cancellationPolicy: profile.cancellationPolicy,
    supportContact: profile.supportContact,
    legalInfo: profile.legalInfo,
    videoVisitUrl: profile.videoVisitUrl,
    hourlyRate: Number(profile.hourlyRate),
    photoUrl: profile.photoUrl,
    photoGallery: [...profile.photoGallery],
  };
}

export function mergeProfileDraft(
  base: InstructorProfileDraftPayload,
  patch: InstructorProfileDraftPayload,
): InstructorProfileDraftPayload {
  return {
    ...base,
    ...patch,
    certifications: patch.certifications ?? base.certifications,
    skillLevels: patch.skillLevels ?? base.skillLevels,
    languages: patch.languages ?? base.languages,
    specializations: patch.specializations ?? base.specializations,
    specializationOffers: patch.specializationOffers ?? base.specializationOffers,
    additionalServices: patch.additionalServices ?? base.additionalServices,
    offeredDurations: patch.offeredDurations ?? base.offeredDurations,
    achievements: patch.achievements ?? base.achievements,
    photoGallery: patch.photoGallery ?? base.photoGallery,
    availabilitySlots: patch.availabilitySlots ?? base.availabilitySlots,
  };
}

export function draftToProfileUpdate(
  draft: InstructorProfileDraftPayload,
): Prisma.InstructorProfileUncheckedUpdateInput {
  const offers = draft.specializationOffers;
  const specs =
    offers?.map((o) => o.label) ??
    (draft.specializations ? canonicalizeActivityLabels(draft.specializations) : undefined);

  const data: Prisma.InstructorProfileUncheckedUpdateInput = {};

  if (draft.bio !== undefined) data.bio = draft.bio;
  if (draft.certificationLevel !== undefined) data.certificationLevel = draft.certificationLevel;
  if (draft.certifications !== undefined) data.certifications = draft.certifications;
  if (draft.skillLevels !== undefined) data.skillLevels = draft.skillLevels;
  if (draft.languages !== undefined) data.languages = draft.languages;
  if (specs !== undefined) data.specializations = specs;
  if (offers !== undefined && offers.length > 0) {
    data.specializationOffers = offers;
    data.hourlyRate = syncProfileHourlyRateFromOffers(offers, draft.hourlyRate ?? 2500);
    data.totalLessons = offers.reduce((s, o) => s + o.lessonsCompleted, 0);
  } else if (draft.hourlyRate !== undefined) {
    data.hourlyRate = draft.hourlyRate;
  }
  if (draft.additionalServices !== undefined) data.additionalServices = draft.additionalServices;
  if (draft.offeredDurations !== undefined) data.offeredDurations = draft.offeredDurations;
  if (draft.achievements !== undefined) data.achievements = draft.achievements;
  if (draft.experienceYears !== undefined) data.experienceYears = draft.experienceYears;
  if (draft.totalLessons !== undefined && offers === undefined) data.totalLessons = draft.totalLessons;
  if (draft.age !== undefined) data.age = draft.age;
  if (draft.availabilitySlots !== undefined) {
    data.availabilitySlots =
      draft.availabilitySlots === null
        ? Prisma.JsonNull
        : (draft.availabilitySlots as Prisma.InputJsonValue);
  }
  if (draft.cancellationPolicy !== undefined) data.cancellationPolicy = draft.cancellationPolicy;
  if (draft.supportContact !== undefined) data.supportContact = draft.supportContact;
  if (draft.legalInfo !== undefined) data.legalInfo = draft.legalInfo;
  if (draft.videoVisitUrl !== undefined) data.videoVisitUrl = draft.videoVisitUrl || null;
  if (draft.photoUrl !== undefined) data.photoUrl = draft.photoUrl;
  if (draft.photoGallery !== undefined) data.photoGallery = draft.photoGallery;

  return data;
}

export function draftDisplayName(draft: InstructorProfileDraftPayload): string | null {
  const full = [draft.firstName?.trim(), draft.lastName?.trim()].filter(Boolean).join(" ");
  return full || null;
}

/** Преобразует черновик в форму полей профиля для ответа API / отображения. */
export function draftAsProfileView(
  draft: InstructorProfileDraftPayload,
): ProfileRow & { firstName: string; lastName: string } {
  const specs = draft.specializations ?? draft.specializationOffers?.map((o) => o.label) ?? [];
  const offers = draft.specializationOffers ?? [];
  const hourly =
    offers.length > 0
      ? syncProfileHourlyRateFromOffers(offers, draft.hourlyRate ?? 2500)
      : (draft.hourlyRate ?? 2500);
  return {
    firstName: draft.firstName ?? "",
    lastName: draft.lastName ?? "",
    bio: draft.bio ?? null,
    certificationLevel: draft.certificationLevel ?? null,
    certifications: draft.certifications ?? [],
    skillLevels: draft.skillLevels ?? [],
    languages: draft.languages ?? [],
    specializations: canonicalizeActivityLabels(specs),
    specializationOffers: offers,
    additionalServices: draft.additionalServices ?? [],
    offeredDurations: draft.offeredDurations ?? [],
    achievements: draft.achievements ?? [],
    experienceYears: draft.experienceYears ?? null,
    totalLessons: draft.totalLessons ?? null,
    age: draft.age ?? null,
    availabilitySlots: draft.availabilitySlots ?? [],
    cancellationPolicy: draft.cancellationPolicy ?? null,
    supportContact: draft.supportContact ?? null,
    legalInfo: draft.legalInfo ?? null,
    videoVisitUrl: draft.videoVisitUrl ?? null,
    hourlyRate: hourly,
    photoUrl: draft.photoUrl ?? null,
    photoGallery: draft.photoGallery ?? [],
  };
}

export function buildDraftPatchFromMePayload(input: {
  firstName?: string;
  lastName?: string;
  bioForUpdate?: string;
  nextCanonSpecs?: string[];
  normalizedOffers?: SpecializationOffer[];
  payload: {
    bio?: string;
    certificationLevel?: string;
    certifications?: string[];
    skillLevels?: string[];
    languages?: string[];
    additionalServices?: string[];
    offeredDurations?: string[];
    achievements?: string[];
    experienceYears?: number;
    totalLessons?: number;
    age?: number;
    availabilitySlots?: Prisma.JsonValue;
    cancellationPolicy?: string;
    supportContact?: string;
    legalInfo?: string;
    videoVisitUrl?: string;
    hourlyRate?: number;
  };
  resolvedCoverUpdate?: string | null | undefined;
}): InstructorProfileDraftPayload {
  const { payload } = input;
  const patch: InstructorProfileDraftPayload = {};

  if (input.firstName !== undefined) patch.firstName = input.firstName.trim();
  if (input.lastName !== undefined) patch.lastName = input.lastName.trim();
  if (input.bioForUpdate !== undefined) patch.bio = input.bioForUpdate;
  if (payload.certificationLevel !== undefined) patch.certificationLevel = payload.certificationLevel;
  if (payload.certifications !== undefined) patch.certifications = payload.certifications;
  if (payload.skillLevels !== undefined) patch.skillLevels = payload.skillLevels;
  if (payload.languages !== undefined) patch.languages = payload.languages;
  if (input.nextCanonSpecs !== undefined) patch.specializations = input.nextCanonSpecs;
  if (input.normalizedOffers !== undefined) patch.specializationOffers = input.normalizedOffers;
  if (payload.additionalServices !== undefined) patch.additionalServices = payload.additionalServices;
  if (payload.offeredDurations !== undefined) patch.offeredDurations = payload.offeredDurations;
  if (payload.achievements !== undefined) patch.achievements = payload.achievements;
  if (payload.experienceYears !== undefined) patch.experienceYears = payload.experienceYears;
  if (payload.totalLessons !== undefined) patch.totalLessons = payload.totalLessons;
  if (payload.age !== undefined) patch.age = payload.age >= 14 ? payload.age : undefined;
  if (payload.availabilitySlots !== undefined) patch.availabilitySlots = payload.availabilitySlots;
  if (payload.cancellationPolicy !== undefined) patch.cancellationPolicy = payload.cancellationPolicy;
  if (payload.supportContact !== undefined) patch.supportContact = payload.supportContact;
  if (payload.legalInfo !== undefined) patch.legalInfo = payload.legalInfo;
  if (payload.videoVisitUrl !== undefined) patch.videoVisitUrl = payload.videoVisitUrl || null;
  if (payload.hourlyRate !== undefined) patch.hourlyRate = payload.hourlyRate;
  if (input.resolvedCoverUpdate !== undefined) patch.photoUrl = input.resolvedCoverUpdate;

  return patch;
}

export type ProfileDraftChangeKind = "added" | "removed" | "changed";

export type ProfileDraftChange = {
  field: string;
  label: string;
  kind: ProfileDraftChangeKind;
  before: string | null;
  after: string | null;
};

const PROFILE_DRAFT_FIELD_LABELS: Record<keyof InstructorProfileDraftPayload, string> = {
  firstName: "Имя",
  lastName: "Фамилия",
  bio: "Биография",
  certificationLevel: "Уровень сертификации",
  certifications: "Сертификаты",
  skillLevels: "Уровни учеников",
  languages: "Языки",
  specializations: "Направления",
  specializationOffers: "Предложения по направлениям",
  additionalServices: "Дополнительные услуги",
  offeredDurations: "Длительности занятий",
  achievements: "Достижения",
  experienceYears: "Опыт (лет)",
  totalLessons: "Всего занятий",
  age: "Возраст",
  availabilitySlots: "Слоты доступности",
  cancellationPolicy: "Политика отмены",
  supportContact: "Контакт поддержки",
  legalInfo: "Юридическая информация",
  videoVisitUrl: "Видеовизитка",
  hourlyRate: "Ставка (₽/ч)",
  photoUrl: "Фото профиля",
  photoGallery: "Галерея",
};

const PROFILE_DRAFT_FIELD_ORDER: (keyof InstructorProfileDraftPayload)[] = [
  "firstName",
  "lastName",
  "bio",
  "certificationLevel",
  "certifications",
  "skillLevels",
  "languages",
  "specializations",
  "specializationOffers",
  "additionalServices",
  "offeredDurations",
  "achievements",
  "experienceYears",
  "totalLessons",
  "age",
  "hourlyRate",
  "cancellationPolicy",
  "supportContact",
  "legalInfo",
  "videoVisitUrl",
  "photoUrl",
  "photoGallery",
  "availabilitySlots",
];

function isEmptyDisplay(v: string | null): boolean {
  return v === null || v.trim() === "" || v === "—";
}

function formatTextValue(v: string | null | undefined, maxLen = 280): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen).trim()}…`;
}

function formatStringList(values: string[] | undefined): string | null {
  if (!values?.length) return null;
  const items = values.map((s) => s.trim()).filter(Boolean);
  if (!items.length) return null;
  return items.join(", ");
}

function formatOffersList(offers: SpecializationOffer[] | undefined): string | null {
  if (!offers?.length) return null;
  return offers
    .map((o) => `${o.label}: ${o.hourlyRate} ₽/ч, ${o.lessonsCompleted} ур.`)
    .join("; ");
}

function formatPhotoUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const t = url.trim();
  if (t.length <= 64) return t;
  return `${t.slice(0, 32)}…${t.slice(-12)}`;
}

function formatPhotoGallery(urls: string[] | undefined): string | null {
  if (!urls?.length) return null;
  const n = urls.filter((u) => u.trim()).length;
  if (n === 0) return null;
  return n === 1 ? "1 фото" : `${n} фото`;
}

function formatAvailabilitySlots(slots: Prisma.JsonValue | undefined): string | null {
  if (slots == null) return null;
  if (Array.isArray(slots)) {
    if (slots.length === 0) return null;
    return slots.length === 1 ? "1 слот" : `${slots.length} слотов`;
  }
  return "изменены";
}

function formatDraftFieldValue(
  key: keyof InstructorProfileDraftPayload,
  draft: InstructorProfileDraftPayload,
): string | null {
  switch (key) {
    case "firstName":
    case "lastName":
    case "bio":
    case "certificationLevel":
    case "cancellationPolicy":
    case "supportContact":
    case "legalInfo":
    case "videoVisitUrl":
      return formatTextValue(draft[key] ?? null);
    case "experienceYears":
    case "totalLessons":
    case "age":
    case "hourlyRate": {
      const n = draft[key];
      if (n == null || !Number.isFinite(n)) return null;
      return String(n);
    }
    case "certifications":
    case "skillLevels":
    case "languages":
    case "specializations":
    case "additionalServices":
    case "offeredDurations":
    case "achievements":
      return formatStringList(draft[key]);
    case "specializationOffers":
      return formatOffersList(draft.specializationOffers);
    case "photoUrl":
      return formatPhotoUrl(draft.photoUrl);
    case "photoGallery":
      return formatPhotoGallery(draft.photoGallery);
    case "availabilitySlots":
      return formatAvailabilitySlots(draft.availabilitySlots);
    default:
      return null;
  }
}

function valuesEqual(
  key: keyof InstructorProfileDraftPayload,
  before: InstructorProfileDraftPayload,
  after: InstructorProfileDraftPayload,
): boolean {
  const a = formatDraftFieldValue(key, before);
  const b = formatDraftFieldValue(key, after);
  if (isEmptyDisplay(a) && isEmptyDisplay(b)) return true;
  return a === b;
}

function changeKind(before: string | null, after: string | null): ProfileDraftChangeKind {
  const wasEmpty = isEmptyDisplay(before);
  const nowEmpty = isEmptyDisplay(after);
  if (wasEmpty && !nowEmpty) return "added";
  if (!wasEmpty && nowEmpty) return "removed";
  return "changed";
}

/** Сравнивает опубликованную анкету и черновик; только отличающиеся поля. */
export function computeProfileDraftChanges(
  before: InstructorProfileDraftPayload,
  after: InstructorProfileDraftPayload,
): ProfileDraftChange[] {
  const changes: ProfileDraftChange[] = [];

  for (const key of PROFILE_DRAFT_FIELD_ORDER) {
    if (valuesEqual(key, before, after)) continue;
    const beforeText = formatDraftFieldValue(key, before);
    const afterText = formatDraftFieldValue(key, after);
    changes.push({
      field: key,
      label: PROFILE_DRAFT_FIELD_LABELS[key],
      kind: changeKind(beforeText, afterText),
      before: beforeText,
      after: afterText,
    });
  }

  return changes;
}
