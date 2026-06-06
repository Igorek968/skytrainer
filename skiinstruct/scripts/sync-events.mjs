/**
 * Экспорт / импорт опубликованных мероприятий (по email инструктора + title).
 *
 * export: DATABASE_URL=... node scripts/sync-events.mjs export > events.json
 * import: DATABASE_URL=... node scripts/sync-events.mjs import events.json
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function exportEvents() {
  const now = new Date();
  const rows = await prisma.instructorEvent.findMany({
    where: {
      moderationStatus: "PUBLISHED",
      OR: [{ eventAt: null }, { eventAt: { gt: now } }],
    },
    include: {
      instructor: { select: { email: true } },
      slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
    },
    orderBy: { createdAt: "asc" },
  });

  const payload = rows.map((row) => ({
    instructorEmail: row.instructor.email,
    title: row.title,
    body: row.body,
    photoUrl: row.photoUrl,
    eventAt: row.eventAt?.toISOString() ?? null,
    moderationStatus: row.moderationStatus,
    priceRub: row.priceRub,
    maxRegistrations: row.maxRegistrations,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    slots: row.slots.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      maxSeats: s.maxSeats,
      priceRub: s.priceRub,
      sortOrder: s.sortOrder,
    })),
  }));

  process.stdout.write(JSON.stringify(payload, null, 2));
}

async function importEvents(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const payload = JSON.parse(raw);

  for (const row of payload) {
    const instructor = await prisma.user.findUnique({
      where: { email: row.instructorEmail },
      select: { id: true },
    });
    if (!instructor) {
      console.error(`SKIP ${row.title}: instructor ${row.instructorEmail} not found`);
      continue;
    }

    let titleRef = await prisma.instructorEventTitle.findUnique({
      where: { instructorId_title: { instructorId: instructor.id, title: row.title } },
    });
    if (!titleRef) {
      titleRef = await prisma.instructorEventTitle.create({
        data: { instructorId: instructor.id, title: row.title },
      });
    }

    const existing = await prisma.instructorEvent.findFirst({
      where: { instructorId: instructor.id, title: row.title, moderationStatus: "PUBLISHED" },
    });

    const eventData = {
      title: row.title,
      body: row.body,
      photoUrl: row.photoUrl,
      eventAt: row.eventAt ? new Date(row.eventAt) : null,
      moderationStatus: "PUBLISHED",
      priceRub: row.priceRub,
      maxRegistrations: row.maxRegistrations,
      publishedAt: row.publishedAt ? new Date(row.publishedAt) : new Date(),
      submittedAt: row.submittedAt ? new Date(row.submittedAt) : new Date(),
      rejectNote: null,
      titleId: titleRef.id,
    };

    let event;
    if (existing) {
      event = await prisma.instructorEvent.update({
        where: { id: existing.id },
        data: eventData,
      });
      await prisma.eventSlot.deleteMany({ where: { eventId: event.id } });
    } else {
      event = await prisma.instructorEvent.create({
        data: { instructorId: instructor.id, ...eventData },
      });
    }

    if (row.slots?.length) {
      await prisma.eventSlot.createMany({
        data: row.slots.map((s) => ({
          eventId: event.id,
          startsAt: new Date(s.startsAt),
          maxSeats: s.maxSeats,
          priceRub: s.priceRub,
          sortOrder: s.sortOrder ?? 0,
        })),
      });
    }

    console.error(`OK ${row.instructorEmail} -> ${row.title}`);
  }

  console.error(`Imported ${payload.length} event(s).`);
}

async function main() {
  const [cmd, filePath] = process.argv.slice(2);
  if (cmd === "export") {
    await exportEvents();
    return;
  }
  if (cmd === "import" && filePath) {
    await importEvents(filePath);
    return;
  }
  console.error("Usage: sync-events.mjs export | import <file.json>");
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
