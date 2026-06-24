import { processScheduledPushReminders } from "@/lib/services/scheduled-reminders";
import { retryPendingInstructorOrderPush } from "@/lib/services/instructor-order-notify-retry";

const TICK_MS = 30_000;
const globalStartedKey = Symbol.for("skiinstruct.internalSchedulerStarted");

/** Встроенный планировщик (без внешнего cron). По умолчанию включён в production. */
export function isInternalSchedulerEnabled(): boolean {
  const v = process.env.SKIINSTRUCT_INTERNAL_SCHEDULER?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  if (v === "1" || v === "true" || v === "on") return true;
  return process.env.NODE_ENV === "production";
}

export function startInternalScheduler(): void {
  if (!isInternalSchedulerEnabled()) {
    console.log("[scheduler] internal scheduler disabled (SKIINSTRUCT_INTERNAL_SCHEDULER)");
    return;
  }

  const g = globalThis as typeof globalThis & { [key: symbol]: boolean | undefined };
  if (g[globalStartedKey]) return;
  g[globalStartedKey] = true;

  const tick = async () => {
    try {
      await retryPendingInstructorOrderPush();
      const r = await processScheduledPushReminders();
      const total =
        r.lessons.startReminders +
        r.lessons.atStartReminders +
        r.lessons.endReminders +
        r.events.clientReminders +
        r.events.instructorReminders;
      if (total > 0) {
        console.log("[scheduler] reminders sent", JSON.stringify(r));
      }
    } catch (e) {
      console.error("[scheduler] tick failed:", e);
    }
  };

  void tick();
  setInterval(() => void tick(), TICK_MS);
  console.log("[scheduler] internal push reminders started (every 30s)");
}
