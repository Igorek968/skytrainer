/**
 * Сброс пароля инструктора для локальной отладки.
 * Создаёт полную анкету, если её ещё нет (роль INSTRUCTOR без instructorProfile).
 * Пример: node prisma/reset-instructor-password.mjs instructor1@ya.ru Password123!
 */
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const { hash } = require("bcryptjs");

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
  return [
    {
      label: DEFAULT_PRIMARY_SPEC,
      hourlyRate,
      lessonsCompleted: 0,
    },
  ];
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

const email = process.argv[2];
const password = process.argv[3] ?? "Password123!";

if (!email) {
  console.error("Usage: node prisma/reset-instructor-password.mjs <email> [password]");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true, email: true },
  });
  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }
  const passwordHash = await hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, role: "INSTRUCTOR" },
  });

  const existingProfile = await prisma.instructorProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!existingProfile) {
    await prisma.instructorProfile.create({
      data: buildDefaultProfileCreate(user.id),
    });
    console.log("OK:", user.email, "role=INSTRUCTOR", "profile=created", "password=", password);
    return;
  }

  console.log("OK:", user.email, "role=INSTRUCTOR", "profile=exists", "password=", password);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
