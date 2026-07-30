/**
 * Разовое усиление анкет: «на линии», район работы, по 2 текстовых отзыва.
 * Запуск: npx tsx scripts/enrich-instructor-trust.ts
 */
import { PrismaClient, type SkillLevel, type LessonDuration } from "@prisma/client";

import { nearestMapCityCenter } from "../src/lib/map-city-centers";

const prisma = new PrismaClient();

const DISTRICTS_BY_CITY: Record<string, string[]> = {
  sochi: ["Сочи · Центральный район", "Сочи · Хостинский район", "Сочи · Адлер"],
  "krasnaya-polyana": ["Красная Поляна", "Эсто-Садок · Роза Хутор", "Горки Город"],
  moskva: ["Москва · ЦАО", "Москва · ЮЗАО", "Москва · САО", "Москва · ЗАО", "Москва · СВАО"],
  "sankt-peterburg": ["СПб · Центральный", "СПб · Василеостровский", "СПб · Приморский"],
  kazan: ["Казань · Вахитовский", "Казань · Советский", "Казань · Приволжский"],
  ekaterinburg: ["Екатеринбург · Центр", "Екатеринбург · Верх-Исетский"],
  novosibirsk: ["Новосибирск · Центральный", "Новосибирск · Советский"],
  krasnodar: ["Краснодар · Центральный", "Краснодар · Карасунский"],
  kaliningrad: ["Калининград · Центр", "Калининград · Ленинградский"],
  dombay: ["Домбай", "Теберда"],
};

const REVIEW_TEXTS = [
  "Всё чётко: вовремя на месте, спокойно объясняет, после занятия сразу прогресс. Рекомендую.",
  "Запись и оплата через сайт без сюрпризов. Инструктор на связи, район удобный — приеду ещё.",
  "Понравился формат: коротко по делу, без воды. Чувствуется, что человек «на линии» и готов взять урок.",
  "Сравнивала несколько анкет — выбрала по отзывам и району. Не пожалела, занятие прошло спокойно.",
  "Удобно, что оплата через ЮKassa и есть правила возврата. Сам урок — на твёрдую пятёрку.",
  "Приехал по объявлению, сайт совпал с оффером. Инструктор рядом, статус «на линии» — откликнулся быстро.",
];

const CLIENT_NAMES = [
  "Анна К.",
  "Дмитрий С.",
  "Мария П.",
  "Игорь В.",
  "Елена Р.",
  "Павел Н.",
  "Ольга М.",
  "Сергей Т.",
];

function pickStable<T>(items: T[], seed: string, salt: number): T {
  let h = salt;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return items[h % items.length]!;
}

function resolveDistrict(lat: number | null, lng: number | null, userId: string): string {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const city = nearestMapCityCenter(lat, lng);
    const options = DISTRICTS_BY_CITY[city.slug] ?? [`${city.name}`];
    return pickStable(options, userId, 17);
  }
  return pickStable(DISTRICTS_BY_CITY.moskva!, userId, 17);
}

async function ensureReviewClients(count: number) {
  const clients: { id: string; name: string }[] = [];
  for (let i = 0; i < count; i++) {
    const email = `trust-reviewer-${i + 1}@internal.local`;
    const name = CLIENT_NAMES[i % CLIENT_NAMES.length]!;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name,
        role: "CLIENT",
        emailVerified: new Date(),
      },
      update: { name },
      select: { id: true, name: true },
    });
    clients.push({ id: user.id, name: user.name ?? name });
  }
  return clients;
}

async function recountRating(instructorId: string) {
  const rated = await prisma.order.findMany({
    where: {
      instructorId,
      status: "COMPLETED",
      clientRating: { not: null },
    },
    select: { clientRating: true },
  });
  const reviewCount = rated.length;
  const ratingAvg =
    reviewCount === 0
      ? 0
      : Math.round((rated.reduce((s, r) => s + (r.clientRating ?? 0), 0) / reviewCount) * 10) / 10;
  await prisma.instructorProfile.update({
    where: { userId: instructorId },
    data: { ratingAvg, reviewCount },
  });
}

async function main() {
  const reviewers = await ensureReviewClients(8);
  const instructors = await prisma.user.findMany({
    where: {
      role: "INSTRUCTOR",
      suspendedAt: null,
      instructorProfile: { is: { verificationStatus: "APPROVED" } },
    },
    include: { instructorProfile: true },
  });

  console.log(`Approved instructors: ${instructors.length}`);

  let updatedDistrict = 0;
  let setOnline = 0;
  let reviewsAdded = 0;

  for (const inst of instructors) {
    const p = inst.instructorProfile;
    if (!p) continue;

    const workDistrict = p.workDistrict?.trim() || resolveDistrict(p.lat, p.lng, inst.id);
    const patch: { workDistrict: string; isOnline?: boolean } = { workDistrict };
    if (!p.isOnline) {
      patch.isOnline = true;
      setOnline += 1;
    }
    if (p.workDistrict?.trim() !== workDistrict || patch.isOnline) {
      await prisma.instructorProfile.update({
        where: { id: p.id },
        data: patch,
      });
      if (p.workDistrict?.trim() !== workDistrict) updatedDistrict += 1;
    }

    const existingTextReviews = await prisma.order.count({
      where: {
        instructorId: inst.id,
        status: "COMPLETED",
        clientRating: { not: null },
        clientReview: { not: null },
      },
    });
    const need = Math.max(0, 2 - existingTextReviews);
    if (need === 0) {
      await recountRating(inst.id);
      continue;
    }

    const lat = p.lat ?? 55.7558;
    const lng = p.lng ?? 37.6173;
    const rate = Number(p.hourlyRate) || 3000;

    for (let i = 0; i < need; i++) {
      const client = pickStable(reviewers, `${inst.id}:${i}`, 41 + i);
      const text = pickStable(REVIEW_TEXTS, `${inst.id}:r${i}`, 7);
      const rating = pickStable([5, 5, 5, 4], `${inst.id}:stars${i}`, 3) as number;
      const started = new Date(Date.now() - (14 + i) * 24 * 60 * 60 * 1000);
      const ended = new Date(started.getTime() + 60 * 60 * 1000);

      await prisma.order.create({
        data: {
          clientId: client.id,
          instructorId: inst.id,
          status: "COMPLETED",
          meetLat: lat,
          meetLng: lng,
          meetAddress: workDistrict,
          skillLevel: "INTERMEDIATE" as SkillLevel,
          languagePref: "Русский",
          duration: "ONE_HOUR" as LessonDuration,
          disciplineLabel: p.specializations[0] ?? null,
          notes: "trust-seed-review",
          acceptedAt: started,
          lessonStartedAt: started,
          lessonEndedAt: ended,
          clientRating: rating,
          clientReview: text,
          agreedHourlyRate: rate,
          amountTotal: rate,
          instructorShareAmount: Math.round(rate * 0.85),
          paymentMethod: "CARD",
          paymentStatus: "PAID",
        },
      });
      reviewsAdded += 1;
    }

    await recountRating(inst.id);
  }

  console.log(
    JSON.stringify(
      {
        instructors: instructors.length,
        updatedDistrict,
        setOnline,
        reviewsAdded,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
