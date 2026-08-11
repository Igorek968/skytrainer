/** Черновики форм в sessionStorage — восстановление после «Назад» с юридических страниц. */

export function saveFormDraft<T>(key: string, data: T): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readFormDraft<T>(key: string): T | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const FORM_DRAFT_KEYS = {
  instructorApply: "skiinstruct_form_draft:instructor_apply_v3",
  clientRegister: "skiinstruct_form_draft:client_register",
} as const;
