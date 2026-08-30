export const EVENT_PARTY_MAX_PEOPLE = 20;

export type EventPartyCounts = {
  adultCount: number;
  childCount: number;
};

export function normalizeEventParty(
  raw: { adultCount?: number | null; childCount?: number | null } | null | undefined,
): EventPartyCounts {
  const adultCount = Math.max(0, Math.min(EVENT_PARTY_MAX_PEOPLE, Math.round(raw?.adultCount ?? 1)));
  const childCount = Math.max(0, Math.min(EVENT_PARTY_MAX_PEOPLE, Math.round(raw?.childCount ?? 0)));
  return { adultCount, childCount };
}

/** Сколько мест занимает заявка. */
export function eventRegistrationSeatCount(
  raw: { adultCount?: number | null; childCount?: number | null } | null | undefined,
): number {
  const { adultCount, childCount } = normalizeEventParty(raw);
  const total = adultCount + childCount;
  return total > 0 ? total : 1;
}

export function formatSeatCountRu(n: number): string {
  const count = Math.max(0, Math.round(n));
  return `${count} ${ruPeople(count, "человек", "человека", "человек")}`;
}

export function formatEventPartyRu(
  raw: { adultCount?: number | null; childCount?: number | null } | null | undefined,
): string {
  return formatSeatCountRu(eventRegistrationSeatCount(raw));
}

function ruPeople(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

export function eventPartyError(
  raw: { adultCount?: number | null; childCount?: number | null },
): string | null {
  const { adultCount, childCount } = normalizeEventParty(raw);
  if (adultCount + childCount < 1) {
    return "Укажите хотя бы одного участника";
  }
  if (adultCount + childCount > EVENT_PARTY_MAX_PEOPLE) {
    return `В одной заявке не больше ${EVENT_PARTY_MAX_PEOPLE} человек`;
  }
  return null;
}
