import { prisma } from "@/lib/prisma";

/** Создаёт или находит каталоговое название мероприятия. */
export async function upsertInstructorEventTitle(instructorId: string, title: string) {
  const normalized = title.trim();
  return prisma.instructorEventTitle.upsert({
    where: {
      instructorId_title: { instructorId, title: normalized },
    },
    create: { instructorId, title: normalized },
    update: {},
  });
}

export async function listInstructorEventTitles(instructorId: string) {
  const rows = await prisma.instructorEventTitle.findMany({
    where: { instructorId },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
  return rows;
}

/** Черновик / отклонённое / на модерации — для подгрузки в форму (не опубликованные и не скрытые). */
export async function findLatestEventByTitle(instructorId: string, title: string) {
  const normalized = title.trim();
  return prisma.instructorEvent.findFirst({
    where: {
      instructorId,
      title: normalized,
      moderationStatus: { in: ["DRAFT", "REJECTED", "PENDING_REVIEW"] },
    },
    orderBy: { updatedAt: "desc" },
  });
}
