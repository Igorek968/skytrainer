const DISMISSED_KEY = "instructor_dismissed_pending_prompt_v1";

export function readDismissedPendingPromptIds(): Set<string> {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set<string>();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set<string>();
    return new Set(arr.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set<string>();
  }
}

export function dismissPendingPrompt(orderId: string): void {
  if (typeof window === "undefined") return;
  const ids = readDismissedPendingPromptIds();
  ids.add(orderId);
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}
