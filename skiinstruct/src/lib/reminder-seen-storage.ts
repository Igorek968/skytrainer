const KEY = "skiinstruct_reminder_seen_v1";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function writeSet(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function wasReminderShown(tag: string): boolean {
  return readSet().has(tag);
}

export function markReminderShown(tag: string): void {
  const set = readSet();
  set.add(tag);
  writeSet(set);
}
