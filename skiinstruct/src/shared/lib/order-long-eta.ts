/** ETA больше порога — заявка не закрывается по таймеру 60 с (ожидает ручной отмены). */
export const LONG_INSTRUCTOR_ETA_MINUTES = 30;

export function isLongInstructorEtaMinutes(etaMinutes: number | null | undefined): boolean {
  if (etaMinutes == null || !Number.isFinite(etaMinutes)) return false;
  return Math.round(etaMinutes) > LONG_INSTRUCTOR_ETA_MINUTES;
}
