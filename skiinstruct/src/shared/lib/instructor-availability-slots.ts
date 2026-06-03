export type AvailabilitySlot = { day: number; from: string; to: string; busy?: boolean };

export function hmToMinutes(hm: string): number {
  const m = hm.trim().match(/^(\d{2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function normalizeAvailabilitySlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  return slots
    .map((slot) => ({ ...slot, from: slot.from.trim(), to: slot.to.trim(), busy: false }))
    .filter((slot) => slot.from && slot.to);
}

export function validateAvailabilitySlots(slots: AvailabilitySlot[]): string | null {
  const normalized = normalizeAvailabilitySlots(slots);
  if (!normalized.length) {
    return "Добавьте хотя бы один свободный интервал";
  }
  const invalid = normalized.find(
    (slot) =>
      slot.day < 0 ||
      slot.day > 6 ||
      !/^\d{2}:\d{2}$/.test(slot.from) ||
      !/^\d{2}:\d{2}$/.test(slot.to) ||
      slot.from >= slot.to,
  );
  if (invalid) {
    return "Проверьте интервалы: формат ЧЧ:ММ и время «с» меньше времени «до»";
  }
  return null;
}

/** Час [hour, hour+1) пересекается со свободным слотом дня недели. */
export function hourInAvailabilityTemplate(
  weekday: number,
  hour: number,
  slots: AvailabilitySlot[],
): boolean {
  const cellFrom = hour * 60;
  const cellTo = (hour + 1) * 60;
  return slots.some(
    (s) =>
      s.day === weekday &&
      s.busy !== true &&
      hmToMinutes(s.from) < cellTo &&
      hmToMinutes(s.to) > cellFrom,
  );
}
