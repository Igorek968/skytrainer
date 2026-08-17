import { timingSafeEqual } from "node:crypto";

/** Сравнение секретов без утечки по времени (раз разной длины — сразу false). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  if (left.length === 0) return true;
  return timingSafeEqual(left, right);
}
