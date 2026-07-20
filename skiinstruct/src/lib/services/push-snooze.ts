import { sendWebPushToUser, type PushPayload } from "@/lib/push-web";

type SnoozeEntry = {
  userId: string;
  payload: PushPayload;
  deliverAt: number;
};

const QUEUE_KEY = Symbol.for("skiinstruct.pushSnoozeQueue");

function queue(): SnoozeEntry[] {
  const g = globalThis as typeof globalThis & { [key: symbol]: SnoozeEntry[] | undefined };
  if (!g[QUEUE_KEY]) g[QUEUE_KEY] = [];
  return g[QUEUE_KEY]!;
}

const SNOOZE_MS = 60 * 60 * 1000; // 1 час

export function schedulePushSnooze(userId: string, payload: PushPayload, delayMs = SNOOZE_MS): void {
  const deliverAt = Date.now() + delayMs;
  const q = queue();
  // Одна отложенная копия на tag
  const next = q.filter((e) => !(e.userId === userId && e.payload.tag === payload.tag));
  next.push({
    userId,
    payload: {
      ...payload,
      title: payload.title.startsWith("⏰") ? payload.title : `⏰ ${payload.title}`,
      tag: `snoozed-${payload.tag}`.slice(0, 120),
    },
    deliverAt,
  });
  gReplace(next);
}

function gReplace(next: SnoozeEntry[]) {
  const g = globalThis as typeof globalThis & { [key: symbol]: SnoozeEntry[] | undefined };
  g[QUEUE_KEY] = next;
}

/** Вызывать из internal scheduler. */
export async function processPushSnoozeQueue(): Promise<number> {
  const now = Date.now();
  const q = queue();
  const due = q.filter((e) => e.deliverAt <= now);
  if (due.length === 0) return 0;
  gReplace(q.filter((e) => e.deliverAt > now));
  let sent = 0;
  for (const e of due) {
    try {
      const r = await sendWebPushToUser(e.userId, e.payload);
      if (r.sent > 0) sent += 1;
    } catch (err) {
      console.error("[push-snooze] send", err instanceof Error ? err.message : err);
    }
  }
  return sent;
}

export const PUSH_SNOOZE_DELAY_MS = SNOOZE_MS;
