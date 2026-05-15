import path from "node:path";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/** Совпадает с INSTRUCTOR_ACTIVITY_LABELS в приложении — фильтр «Направление» и анкета используют те же строки. */
const TAG = {
  alpine: "🎿 Горные лыжи",
  snowboard: "⛷ Сноуборд",
  freeride: "🎿 Фрирайд",
  race: "🚀 Гоночные дисциплины",
  hike: "🥾 Пешие туры",
  mtb: "🚵 Маунтибайк",
  kids: "🧒 Дети",
  adaptive: "👨‍🦽 Адаптивный спорт",
  tennis: "🎾 Большой теннис",
  supSurf: "🛶 Сапсёрфинг",
  volleyball: "🏐 Волейбол",
} as const;

type DemoInstructor = {
  /** Короткое имя для списка и анкеты */
  name: string;
  gender: "male" | "female";
  certificationLevel: string;
  /** Чипы из каталога — по ним работает /api/instructors/nearby */
  specializations: string[];
  languages: string[];
  skillLevels: string[];
  hourlyRate: number;
  ratingAvg: number;
  reviewCount: number;
  bio: string;
};

/**
 * 10 разных «веток» поиска: у каждого свой основной тег + осмысленные комбинации.
 * Клиентский фильтр INTERMEDIATE / TWO_HOURS / Русский по умолчанию совпадает с большинством строк ниже.
 */
const DEMO_INSTRUCTORS: DemoInstructor[] = [
  {
    name: "Игорь Альпика",
    gender: "male",
    certificationLevel: "ISIA Level 2",
    specializations: [TAG.alpine],
    languages: ["Русский"],
    skillLevels: ["Для начинающих", "Средний"],
    hourlyRate: 3200,
    ratingAvg: 4.7,
    reviewCount: 24,
    bio: "Горные лыжи: базовая и средняя техника, работа на больших и средних скоростях.",
  },
  {
    name: "София Бордова",
    gender: "female",
    certificationLevel: "CASI Level 2",
    specializations: [TAG.snowboard],
    languages: ["Русский", "English"],
    skillLevels: ["Для начинающих", "Средний", "Продвинутый"],
    hourlyRate: 3400,
    ratingAvg: 4.8,
    reviewCount: 31,
    bio: "Сноуборд: с нуля до уверенного спуска, переключение и простой фрирайд.",
  },
  {
    name: "Тимур Хребтов",
    gender: "male",
    certificationLevel: "ISIA Level 3",
    specializations: [TAG.freeride, TAG.alpine],
    languages: ["Русский", "Deutsch"],
    skillLevels: ["Средний", "Продвинутый", "Эксперт"],
    hourlyRate: 5200,
    ratingAvg: 4.9,
    reviewCount: 18,
    bio: "Фрирайд и безопасность вне трасс, понимание снежного покрова и маршрутов.",
  },
  {
    name: "Кристина Спортина",
    gender: "female",
    certificationLevel: "ISIA Level 2",
    specializations: [TAG.race, TAG.alpine],
    languages: ["Русский", "English"],
    /** Включаем «Средний», чтобы совпадать с фильтром INTERMEDIATE по умолчанию на /client */
    skillLevels: ["Средний", "Продвинутый", "Эксперт"],
    hourlyRate: 4500,
    ratingAvg: 4.6,
    reviewCount: 14,
    bio: "Гоночная подготовка и карвинг на подготовленном склоне.",
  },
  {
    name: "Эльмира Тропина",
    gender: "female",
    certificationLevel: "Горный гид",
    specializations: [TAG.hike],
    languages: ["Русский", "English"],
    skillLevels: ["Для начинающих", "Средний"],
    hourlyRate: 2800,
    ratingAvg: 4.5,
    reviewCount: 22,
    bio: "Пешие маршруты средней сложности у подножия и низкогорье, акцент на безопасность группы.",
  },
  {
    name: "Роман Трейлов",
    gender: "male",
    certificationLevel: "Инструктор маунтибайка",
    specializations: [TAG.mtb],
    languages: ["Русский"],
    skillLevels: ["Для начинающих", "Средний"],
    hourlyRate: 2600,
    ratingAvg: 4.4,
    reviewCount: 11,
    bio: "Маунтибайк: техника на грунте и простые спуски, подбор трасс под уровень.",
  },
  {
    name: "Алиса Детлэнд",
    gender: "female",
    certificationLevel: "ISIA Level 1",
    specializations: [TAG.kids, TAG.alpine],
    languages: ["Русский", "English"],
    skillLevels: ["Для начинающих", "Средний"],
    hourlyRate: 3800,
    ratingAvg: 4.9,
    reviewCount: 40,
    bio: "Занятия с детьми на горных лыжах: игровая форма и короткие сессии.",
  },
  {
    name: "Пётр Инклюзив",
    gender: "male",
    certificationLevel: "ISIA Level 2",
    specializations: [TAG.adaptive, TAG.alpine],
    languages: ["Русский", "English"],
    skillLevels: ["Для начинающих", "Средний", "Продвинутый"],
    hourlyRate: 4100,
    ratingAvg: 4.8,
    reviewCount: 16,
    bio: "Адаптивная техника и сопровождение на склоне, подбор оборудования и темпа.",
  },
  {
    name: "Марк Двухлыжник",
    gender: "male",
    certificationLevel: "ISIA Level 3",
    specializations: [TAG.alpine, TAG.freeride],
    languages: ["Русский", "Italiano"],
    skillLevels: ["Средний", "Продвинутый"],
    hourlyRate: 4800,
    ratingAvg: 4.7,
    reviewCount: 27,
    bio: "Горные лыжи и контролируемый фрирайд: переход от подготовленной трассы к мягкому склону.",
  },
  {
    name: "Диана Джибова",
    gender: "female",
    certificationLevel: "CASI Level 1",
    specializations: [TAG.snowboard, TAG.kids],
    languages: ["Русский", "Français"],
    skillLevels: ["Для начинающих", "Средний"],
    hourlyRate: 3500,
    ratingAvg: 4.6,
    reviewCount: 19,
    bio: "Сноуборд для подростков и детей: безопасные углы и простые элементы.",
  },
];

function plusDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function daySlots(day: number) {
  return [{ day, from: "09:00", to: "16:00", busy: false }];
}

function demoEmail(index: number): string {
  const n = String(index + 1).padStart(2, "0");
  return `demo-skier-${n}@example.com`;
}

/** Убираем старые демо-логины, чтобы не дублировать «одну анкету — несколько входов». */
async function deleteLegacyDemoInstructors(prismaClient: PrismaClient): Promise<number> {
  const res = await prismaClient.user.deleteMany({
    where: {
      role: "INSTRUCTOR",
      OR: [
        { email: { startsWith: "same-day-instructor" } },
        { email: { startsWith: "future-day-instructor" } },
        { email: { startsWith: "demo-skier-" } },
      ],
    },
  });
  return res.count;
}

async function upsertDemoInstructor(
  prismaClient: PrismaClient,
  index: number,
  template: DemoInstructor,
  availabilityDays: number[],
  lat: number,
  lng: number,
) {
  const passwordHash = await hash("Password123!", 12);
  const email = demoEmail(index);

  const user = await prismaClient.user.upsert({
    where: { email },
    update: {
      name: template.name,
      role: "INSTRUCTOR",
      passwordHash,
    },
    create: {
      email,
      name: template.name,
      role: "INSTRUCTOR",
      passwordHash,
    },
  });

  const availabilitySlots = availabilityDays.flatMap((day) => daySlots(day));

  await prismaClient.instructorProfile.upsert({
    where: { userId: user.id },
    update: {
      bio: template.bio,
      certificationLevel: template.certificationLevel,
      certifications: [template.certificationLevel],
      skillLevels: template.skillLevels,
      languages: template.languages,
      specializations: template.specializations,
      additionalServices: ["Видеоразбор техники", "Фотосъёмка на склоне"],
      offeredDurations: ["1 ч", "1.5 ч", "2 ч", "Полдня"],
      availabilitySlots,
      hourlyRate: template.hourlyRate,
      isOnline: true,
      verificationStatus: "APPROVED",
      lat,
      lng,
      ratingAvg: template.ratingAvg,
      reviewCount: template.reviewCount,
      age: 26 + (index % 15),
      experienceYears: 4 + (index % 10),
      totalLessons: 60 + index * 22,
    },
    create: {
      userId: user.id,
      bio: template.bio,
      certificationLevel: template.certificationLevel,
      certifications: [template.certificationLevel],
      skillLevels: template.skillLevels,
      languages: template.languages,
      specializations: template.specializations,
      additionalServices: ["Видеоразбор техники", "Фотосъёмка на склоне"],
      offeredDurations: ["1 ч", "1.5 ч", "2 ч", "Полдня"],
      availabilitySlots,
      hourlyRate: template.hourlyRate,
      isOnline: true,
      verificationStatus: "APPROVED",
      lat,
      lng,
      ratingAvg: template.ratingAvg,
      reviewCount: template.reviewCount,
      age: 26 + (index % 15),
      experienceYears: 4 + (index % 10),
      totalLessons: 60 + index * 22,
    },
  });
}

/** Вызывается из prisma/seed.ts и при npm run db:seed:instructors */
export async function seedDemoInstructors(prismaClient: PrismaClient): Promise<void> {
  const removed = await deleteLegacyDemoInstructors(prismaClient);

  const now = new Date();
  const todayDay = now.getDay();
  const tomorrowDay = plusDays(now, 1).getDay();
  const dayAfterTomorrow = plusDays(now, 2).getDay();
  const availabilityDays = [todayDay, tomorrowDay, dayAfterTomorrow];

  const baseLat = 43.658;
  const baseLng = 40.312;

  for (let i = 0; i < DEMO_INSTRUCTORS.length; i += 1) {
    const template = DEMO_INSTRUCTORS[i];
    await upsertDemoInstructor(
      prismaClient,
      i,
      template,
      availabilityDays,
      baseLat + i * 0.0011,
      baseLng + i * 0.0009,
    );
  }

  console.log("Instructor demo seed OK", {
    createdOrUpdated: DEMO_INSTRUCTORS.length,
    removedLegacyRows: removed,
    emails: DEMO_INSTRUCTORS.map((_, i) => demoEmail(i)),
    password: "Password123!",
    hint: "Фильтр «Направление» на /client должен совпадать со специализациями инструктора из этого списка.",
  });
}

function isSeedInstructorsCli(): boolean {
  const script = process.argv[1];
  if (!script) return false;
  const base = path.basename(script);
  return base === "seed-instructors.ts" || base.startsWith("seed-instructors.");
}

/** Запуск только при `tsx prisma/seed-instructors.ts`, не при импорте из seed.ts */
if (isSeedInstructorsCli()) {
  const prisma = new PrismaClient();
  seedDemoInstructors(prisma)
    .then(async () => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
