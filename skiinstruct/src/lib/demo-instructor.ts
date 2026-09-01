import type { Prisma } from "@prisma/client";

/** Демо-инструкторы из prisma/seed-instructors.ts — не показываем клиентам и не шлём заявки. */
export function isDemoInstructorEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return (
    e.startsWith("demo-skier-") ||
    e.startsWith("same-day-instructor") ||
    e.startsWith("future-day-instructor") ||
    e.startsWith("mtk-demo-")
  );
}

/** Prisma-фильтр для списков «живых» инструкторов. */
export const liveInstructorEmailWhere: Pick<Prisma.UserWhereInput, "NOT"> = {
  NOT: {
    OR: [
      { email: { startsWith: "demo-skier-" } },
      { email: { startsWith: "same-day-instructor" } },
      { email: { startsWith: "future-day-instructor" } },
      { email: { startsWith: "mtk-demo-" } },
    ],
  },
};
