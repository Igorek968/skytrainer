/** Нормализация части ФИО для сравнения (без учёта регистра и «ё»). */
export function normalizeDisplayNamePart(part: string): string {
  return part
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

/** Первое слово — имя, остальное — фамилия (как в анкете инструктора). */
export function parseFullNameToParts(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const [firstName = "", ...rest] = parts;
  return { firstName, lastName: rest.join(" ") };
}

/** Ключ для сравнения; null, если имя или фамилия пустые. */
export function buildDisplayNameKey(firstName: string, lastName: string): string | null {
  const first = normalizeDisplayNamePart(firstName);
  const last = normalizeDisplayNamePart(lastName);
  if (!first || !last) return null;
  return `${first}\0${last}`;
}

export function displayNameKeyFromFullName(fullName: string | null | undefined): string | null {
  if (!fullName?.trim()) return null;
  const { firstName, lastName } = parseFullNameToParts(fullName);
  return buildDisplayNameKey(firstName, lastName);
}

export const DISPLAY_NAME_DUPLICATE_MESSAGE =
  "Такое сочетание имени и фамилии уже используется другим участником платформы. Укажите другие имя или фамилию.";
