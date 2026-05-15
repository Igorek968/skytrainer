/**
 * Время первого/последнего дня брони кодируется в `notes` (см. POST /api/orders),
 * чтобы не зависеть от отдельных колонок Prisma и старых сгенерированных клиентов.
 */
const LESSON_TIMES_IN_NOTES =
  /Время:\s*с\s*(\d{2}:\d{2})\s*\(день начала\)\s*до\s*(\d{2}:\d{2})\s*\(день окончания\)/;

export function hasLessonTimeWindowInNotes(notes: string | null | undefined): boolean {
  return LESSON_TIMES_IN_NOTES.test(notes ?? "");
}

/** Строка для UI / уведомлений: «Время (первый / последний день): ЧЧ:ММ — ЧЧ:ММ» */
export function lessonTimeWindowLineFromNotes(notes: string | null | undefined): string | null {
  const m = (notes ?? "").match(LESSON_TIMES_IN_NOTES);
  if (!m) return null;
  return `Время (первый / последний день): ${m[1]} — ${m[2]}`;
}
