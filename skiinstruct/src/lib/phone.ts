/**
 * Российский мобильный: в БД храним 11 цифр, первая — 7.
 * Принимаем ввод с +7, 8, или 10 цифр с 9…
 */
export function normalizeRussianPhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return `7${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("7")) return d;
  if (d.length === 10 && d.startsWith("9")) return `7${d}`;
  return null;
}

export function formatRussianPhoneDisplay(digits: string): string {
  if (digits.length !== 11 || !digits.startsWith("7")) return digits;
  const a = digits.slice(1, 4);
  const b = digits.slice(4, 7);
  const c = digits.slice(7, 9);
  const d = digits.slice(9, 11);
  return `+7 (${a}) ${b}-${c}-${d}`;
}

export function pseudoEmailFromNormalizedPhone(digits: string): string {
  return `${digits}@phone.skiinstruct.local`;
}
