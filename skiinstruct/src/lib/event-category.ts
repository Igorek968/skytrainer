import { z } from "zod";

import {
  canonicalizeActivityLabel,
  instructorActivityLabelsAlphabetical,
} from "@/lib/services/instructor-match";

/** Те же направления, что у инструкторов на карте — единый каталог категорий событий. */
export function eventCategoryOptions(): string[] {
  return instructorActivityLabelsAlphabetical();
}

/** Пустая строка / null → нет категории; иначе канон или ошибка. */
export function parseEventCategory(
  raw: string | null | undefined,
): { ok: true; category: string | null } | { ok: false; error: string } {
  if (raw == null || String(raw).trim() === "") {
    return { ok: true, category: null };
  }
  const canon = canonicalizeActivityLabel(String(raw).trim());
  if (!canon) {
    return { ok: false, error: "Неизвестная категория события" };
  }
  return { ok: true, category: canon };
}

export function requireEventCategory(
  raw: string | null | undefined,
): { ok: true; category: string } | { ok: false; error: string } {
  const parsed = parseEventCategory(raw);
  if (!parsed.ok) return parsed;
  if (!parsed.category) {
    return { ok: false, error: "Выберите категорию события" };
  }
  return { ok: true, category: parsed.category };
}

/** Zod: обязательная категория из каталога. */
export const requiredEventCategorySchema = z
  .string()
  .trim()
  .min(1, "Выберите категорию")
  .max(120)
  .refine((s) => Boolean(canonicalizeActivityLabel(s)), "Неизвестная категория");

/** Zod: опциональная категория. */
export const optionalEventCategorySchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .nullable()
  .refine(
    (s) => s == null || s === "" || Boolean(canonicalizeActivityLabel(s)),
    "Неизвестная категория",
  );

export function normalizeCategoryForDb(raw: string | null | undefined): string | null {
  const parsed = parseEventCategory(raw);
  if (!parsed.ok) return null;
  return parsed.category;
}
