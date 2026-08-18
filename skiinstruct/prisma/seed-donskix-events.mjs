/**
 * 10 событий для donskix-48@yandex.ru.
 * venue не задаём. repeatDaily=true.
 *
 * docker compose exec -T skiinstruct node prisma/seed-donskix-events.mjs
 */
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const EMAIL = "donskix-48@yandex.ru";
const prisma = new PrismaClient();

/** Ориентиры цен Сочи / Красная Поляна (₽/чел.), ориентир 2025–2026. */
const EVENTS = [
  {
    title: "Дайвинг",
    body: "Погружение с инструктором у берега Сочи: экипировка, инструктаж, 30–40 мин под водой. Для новичков и с сертификатом.",
    priceRub: 5500,
    maxRegistrations: 4,
    image: "event-diving.jpg",
  },
  {
    title: "Выход на яхте",
    body: "Морская прогулка на яхте вдоль побережья: купание, фото на палубе, фуршет по договорённости. Группа до 8 человек.",
    priceRub: 4500,
    maxRegistrations: 8,
    image: "event-yacht.jpg",
  },
  {
    title: "Поход на Бзерпинский карниз",
    body: "Пеший тур к Бзерпинскому карнизу: панорамы Кавказа, альпийские луга. 6–8 ч, нужна удобная обувь и вода.",
    priceRub: 3500,
    maxRegistrations: 10,
    image: "event-hike.jpg",
  },
  {
    title: "Поездка в Абхазию",
    body: "Однодневная поездка в Абхазию: Гагра / Новый Афон / озеро Рица — маршрут согласуем. Переезд и сопровождение.",
    priceRub: 4500,
    maxRegistrations: 7,
    image: "event-abkhazia.jpg",
  },
  {
    title: "Дельфинарий",
    body: "Посещение шоу дельфинария в Сочи: билет и сопровождение. Подходит семьям с детьми, длительность около 1 часа.",
    priceRub: 1200,
    maxRegistrations: 15,
    image: "event-dolphin.jpg",
  },
  {
    title: "Джип-тур",
    body: "Джип-тур по горным дорогам Красной Поляны: водопады, смотровые, бездорожье. Каски и инструктаж включены.",
    priceRub: 5500,
    maxRegistrations: 6,
    image: "event-jeep.jpg",
  },
  {
    title: "Поход на ферму",
    body: "Выезд на экоферму: знакомство с животными, дегустация сыров и мёда, прогулка. Для взрослых и детей.",
    priceRub: 2500,
    maxRegistrations: 12,
    image: "event-farm.jpg",
  },
  {
    title: "Квадроциклы",
    body: "Катание на квадроциклах по лесным и горным трассам у Поляны. Экипировка и краткий инструктаж перед стартом.",
    priceRub: 5000,
    maxRegistrations: 6,
    image: "event-atv.jpg",
  },
  {
    title: "Конная прогулка",
    body: "Верховая прогулка по тропам у Красной Поляны: спокойный темп, инструктор рядом. Опыт не обязателен.",
    priceRub: 3000,
    maxRegistrations: 6,
    image: "event-horse.jpg",
  },
  {
    title: "Морская прогулка на катере",
    body: "Катер вдоль побережья Сочи: бухты, купание, фото на фоне гор. Около 1,5–2 часа, группа до 8 человек.",
    priceRub: 3500,
    maxRegistrations: 8,
    image: "event-boat.jpg",
  },
];

function tomorrowAt(hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function resolveImageSource(filename) {
  const candidates = [
    path.join(process.cwd(), "public", "seed-event-covers", filename),
    path.join(process.cwd(), "..", "assets", filename),
    path.join("/assets", filename),
  ];
  for (const p of candidates) {
    try {
      await access(p);
      return p;
    } catch {
      /* next */
    }
  }
  return null;
}

async function main() {
  for (const e of EVENTS) {
    if ([...e.body].length > 200) {
      throw new Error(`Body too long (${[...e.body].length}): ${e.title}`);
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    console.error(`User not found: ${EMAIL}`);
    process.exit(1);
  }
  if (user.role !== "INSTRUCTOR") {
    console.error(`User ${EMAIL} role=${user.role}, expected INSTRUCTOR`);
    process.exit(1);
  }
  console.log(`Instructor: ${user.id} ${user.email}`);

  const uploadsRoot = path.join(process.cwd(), "public", "uploads", "events");
  await mkdir(uploadsRoot, { recursive: true });

  const eventAt = tomorrowAt(10, 0);
  let n = 0;

  for (const spec of EVENTS) {
    let titleRef = await prisma.instructorEventTitle.findUnique({
      where: { instructorId_title: { instructorId: user.id, title: spec.title } },
    });
    if (!titleRef) {
      titleRef = await prisma.instructorEventTitle.create({
        data: { instructorId: user.id, title: spec.title },
      });
    }

    const existing = await prisma.instructorEvent.findFirst({
      where: {
        instructorId: user.id,
        title: spec.title,
        moderationStatus: { in: ["PUBLISHED", "DRAFT", "PENDING_REVIEW"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const baseData = {
      title: spec.title,
      body: spec.body,
      eventAt,
      moderationStatus: "PUBLISHED",
      priceRub: spec.priceRub,
      maxRegistrations: spec.maxRegistrations,
      repeatDaily: true,
      publishedAt: now,
      submittedAt: now,
      rejectNote: null,
      titleId: titleRef.id,
      venueAddress: null,
      venueLat: null,
      venueLng: null,
    };

    let event;
    if (existing) {
      event = await prisma.instructorEvent.update({
        where: { id: existing.id },
        data: baseData,
      });
      await prisma.eventSlot.deleteMany({ where: { eventId: event.id } });
      console.log(`UPDATE ${spec.title} (${spec.priceRub} ₽)`);
    } else {
      event = await prisma.instructorEvent.create({
        data: { instructorId: user.id, ...baseData },
      });
      console.log(`CREATE ${spec.title} (${spec.priceRub} ₽)`);
    }

    const src = await resolveImageSource(spec.image);
    if (src) {
      const filename = `${event.id}-${randomUUID()}.jpg`;
      const dest = path.join(uploadsRoot, filename);
      await copyFile(src, dest);
      await prisma.instructorEvent.update({
        where: { id: event.id },
        data: { photoUrl: `/uploads/events/${filename}` },
      });
      console.log(`  photo ${filename}`);
    } else {
      console.warn(`  photo MISSING ${spec.image}`);
    }

    n += 1;
  }

  console.log(`Done: ${n} events, repeatDaily=true, eventAt=${eventAt.toISOString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
