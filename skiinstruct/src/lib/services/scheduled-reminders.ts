import { processEventPushReminders } from "@/lib/services/event-push-reminders";
import { processLessonPushReminders } from "@/lib/services/lesson-push-reminders";

/** Все push-напоминания «за ~1 час» (уроки + мероприятия) и напоминания о завершении урока. */
export async function processScheduledPushReminders(): Promise<{
  lessons: Awaited<ReturnType<typeof processLessonPushReminders>>;
  events: Awaited<ReturnType<typeof processEventPushReminders>>;
}> {
  const lessons = await processLessonPushReminders();
  const events = await processEventPushReminders();
  return { lessons, events };
}
