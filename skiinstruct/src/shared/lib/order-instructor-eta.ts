/** Парсинг ETA из строки в notes: `ETA инструктора: ~20 мин.` */
export function extractInstructorEtaMinutes(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const etaLine = [...lines].reverse().find((line) => line.startsWith("ETA инструктора:"));
  if (!etaLine) return null;
  const match = etaLine.match(/(\d{1,3})\s*мин/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  if (!Number.isFinite(minutes) || minutes < 1) return null;
  return Math.round(minutes);
}

export function instructorEtaDeadlineFromMinutes(minutes: number, fromMs = Date.now()): Date {
  const m = Math.min(240, Math.max(1, Math.round(minutes)));
  return new Date(fromMs + m * 60_000);
}

export function parseOrderTimestampMs(raw: string | Date | null | undefined): number | null {
  if (raw == null) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Крайний срок прибытия: instructorEtaAt или acceptedAt + минуты из notes. */
export function resolveInstructorArrivalDeadlineMs(order: {
  instructorEtaAt?: string | Date | null;
  acceptedAt?: string | Date | null;
  notes?: string | null;
}): number | null {
  const explicit = parseOrderTimestampMs(order.instructorEtaAt);
  if (explicit != null) return explicit;

  const minutes = extractInstructorEtaMinutes(order.notes);
  if (minutes == null) return null;

  const acceptedMs = parseOrderTimestampMs(order.acceptedAt);
  if (acceptedMs != null) return acceptedMs + minutes * 60_000;

  return instructorEtaDeadlineFromMinutes(minutes).getTime();
}

export function formatCountdownMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Человекочитаемый отсчёт для карточки клиента. */
export function formatArrivalCountdownRu(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return sec > 0 ? `${m} мин ${sec} сек` : `${m} мин`;
  }
  return `${s} сек`;
}
