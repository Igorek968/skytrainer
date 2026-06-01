const MEET_ADDRESS_PREFIX = "Место встречи:";

/** Строка в notes для обратной совместимости и уведомлений. */
export function formatMeetAddressLine(address: string): string {
  const trimmed = address.trim();
  return `${MEET_ADDRESS_PREFIX} ${trimmed}`;
}

export function extractMeetAddressFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const line = notes
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.toLowerCase().startsWith(MEET_ADDRESS_PREFIX.toLowerCase()));
  if (!line) return null;
  const value = line.slice(MEET_ADDRESS_PREFIX.length).trim();
  return value || null;
}

export function resolveMeetAddress(order: {
  meetAddress?: string | null;
  notes?: string | null;
}): string | null {
  const direct = order.meetAddress?.trim();
  if (direct) return direct;
  return extractMeetAddressFromNotes(order.notes);
}

export function orderHasMeetAddress(order: {
  meetAddress?: string | null;
  notes?: string | null;
}): boolean {
  return Boolean(resolveMeetAddress(order));
}

export function mergeMeetAddressToNotes(
  rawNotes: string | null | undefined,
  address: string,
): string {
  const line = formatMeetAddressLine(address);
  const withoutOld = (rawNotes ?? "")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => !l.toLowerCase().startsWith(MEET_ADDRESS_PREFIX.toLowerCase()));
  return [...withoutOld, line].filter(Boolean).join("\n").trim();
}
