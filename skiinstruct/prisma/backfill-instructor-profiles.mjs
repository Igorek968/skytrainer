/**
 * Дозаполняет анкеты всех пользователей с ролью INSTRUCTOR.
 * Запуск: node prisma/backfill-instructor-profiles.mjs
 * (в Docker: docker compose exec skiinstruct node prisma/backfill-instructor-profiles.mjs)
 */
import { PrismaClient } from "@prisma/client";

const DEFAULT_SKILL_LEVELS = ["Для начинающих", "Средний", "Продвинутый"];
const DEFAULT_LANGUAGES = ["Русский"];
const DEFAULT_OFFERED_DURATIONS = ["1 ч", "1.5 ч", "2 ч", "Полдня"];
const DEFAULT_ADDITIONAL_SERVICES = ["Видеоразбор техники", "Фотосъёмка на склоне"];
const DEFAULT_PRIMARY_SPEC = "🎿 Горные лыжи";
const DEFAULT_PLACEHOLDER_BIO =
  "Заполните описание опыта, сертификаты и с кем вы работаете (не менее 20 символов).";

function defaultAvailabilitySlots() {
  const baseDay = new Date().getDay();
  return [0, 1, 2].flatMap((offset) => {
    const day = (baseDay + offset) % 7;
    return [{ day, from: "09:00", to: "16:00", busy: false }];
  });
}

function defaultSpecializationOffers(hourlyRate) {
  return [{ label: DEFAULT_PRIMARY_SPEC, hourlyRate, lessonsCompleted: 0 }];
}

function buildDefaultProfileCreate(userId, hourlyRate = 3000) {
  return {
    userId,
    bio: DEFAULT_PLACEHOLDER_BIO,
    certificationLevel: "",
    certifications: [],
    skillLevels: DEFAULT_SKILL_LEVELS,
    languages: DEFAULT_LANGUAGES,
    specializations: [DEFAULT_PRIMARY_SPEC],
    specializationOffers: defaultSpecializationOffers(hourlyRate),
    additionalServices: DEFAULT_ADDITIONAL_SERVICES,
    offeredDurations: DEFAULT_OFFERED_DURATIONS,
    availabilitySlots: defaultAvailabilitySlots(),
    hourlyRate,
    achievements: [],
    verificationStatus: "PENDING",
    isOnline: false,
  };
}

function buildBackfillPatch(profile) {
  const data = {};
  const hourlyRate = Number(profile.hourlyRate) || 3000;

  if (!profile.languages?.length) data.languages = DEFAULT_LANGUAGES;
  if (!profile.skillLevels?.length) data.skillLevels = DEFAULT_SKILL_LEVELS;
  if (!profile.offeredDurations?.length) data.offeredDurations = DEFAULT_OFFERED_DURATIONS;
  if (!profile.additionalServices?.length) data.additionalServices = DEFAULT_ADDITIONAL_SERVICES;
  if (!Array.isArray(profile.availabilitySlots) || profile.availabilitySlots.length === 0) {
    data.availabilitySlots = defaultAvailabilitySlots();
  }

  const specs = profile.specializations?.length
    ? profile.specializations
    : [DEFAULT_PRIMARY_SPEC];
  if (!profile.specializations?.length) data.specializations = specs;
  if (!Array.isArray(profile.specializationOffers) || profile.specializationOffers.length === 0) {
    data.specializationOffers = defaultSpecializationOffers(hourlyRate);
  }
  if (!profile.bio?.trim()) data.bio = DEFAULT_PLACEHOLDER_BIO;

  return data;
}

const prisma = new PrismaClient();

async function main() {
  const instructors = await prisma.user.findMany({
    where: { role: "INSTRUCTOR" },
    select: { id: true, email: true },
  });

  let created = 0;
  let updated = 0;

  for (const user of instructors) {
    const existing = await prisma.instructorProfile.findUnique({ where: { userId: user.id } });
    if (!existing) {
      await prisma.instructorProfile.create({ data: buildDefaultProfileCreate(user.id) });
      created += 1;
      console.log("created profile:", user.email);
      continue;
    }

    const patch = buildBackfillPatch(existing);
    if (Object.keys(patch).length === 0) continue;

    await prisma.instructorProfile.update({ where: { userId: user.id }, data: patch });
    updated += 1;
    console.log("backfilled profile:", user.email, Object.keys(patch).join(", "));
  }

  console.log("OK", { totalInstructors: instructors.length, created, updated });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
