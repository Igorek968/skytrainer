import type { LessonDuration } from "@prisma/client";

import { durationHours } from "@/lib/pricing";
import { START_REMINDER_MAX_MS, START_REMINDER_MIN_MS } from "@/lib/reminder-timing";
import { resolveLessonStartMs } from "@/shared/lib/order-lesson-start";

const MS = 1_000;

/** Допуск «пора начинать»: за 5 мин до старта и до 60 мин после. */
export const LESSON_AT_START_EARLY_MS = 5 * 60 * MS;
export const LESSON_AT_START_LATE_MS = 60 * 60 * MS;

/** После планового конца урока — напоминание завершить сделку. */
export const LESSON_END_GRACE_AFTER_MS = 45 * 60 * MS;

export function isInOneHourReminderWindow(
  requestedStartDate?: string | Date | null,
  nowMs = Date.now(),
): boolean {
  const startMs = resolveLessonStartMs(requestedStartDate);
  if (startMs == null) return false;
  const left = startMs - nowMs;
  return left >= START_REMINDER_MIN_MS && left <= START_REMINDER_MAX_MS;
}

export function isInLessonStartNowWindow(
  requestedStartDate?: string | Date | null,
  nowMs = Date.now(),
): boolean {
  const startMs = resolveLessonStartMs(requestedStartDate);
  if (startMs == null) return false;
  const delta = nowMs - startMs;
  return delta >= -LESSON_AT_START_EARLY_MS && delta <= LESSON_AT_START_LATE_MS;
}

export function expectedLessonEndMs(lessonStartedAt: Date, duration: LessonDuration): number {
  return lessonStartedAt.getTime() + durationHours(duration) * 60 * 60 * MS;
}

export function isInLessonEndReminderWindow(
  lessonStartedAt: Date | string | null | undefined,
  duration: LessonDuration,
  nowMs = Date.now(),
): boolean {
  if (!lessonStartedAt) return false;
  const started = new Date(lessonStartedAt);
  if (!Number.isFinite(started.getTime())) return false;
  const endMs = expectedLessonEndMs(started, duration);
  return nowMs >= endMs - 30 * MS && nowMs <= endMs + LESSON_END_GRACE_AFTER_MS;
}

export function isInScheduledLessonEndWindow(
  requestedStartDate: Date | string | null | undefined,
  duration: LessonDuration,
  nowMs = Date.now(),
): boolean {
  const startMs = resolveLessonStartMs(requestedStartDate);
  if (startMs == null) return false;
  const endMs = startMs + durationHours(duration) * 60 * 60 * MS;
  return nowMs >= endMs - 30 * MS && nowMs <= endMs + LESSON_END_GRACE_AFTER_MS;
}

/** Окно at-start скоро закроется — последняя попытка push. */
export function isLessonStartWindowClosing(
  requestedStartDate: Date | string | null | undefined,
  nowMs = Date.now(),
): boolean {
  const startMs = resolveLessonStartMs(requestedStartDate);
  if (startMs == null) return false;
  return nowMs >= startMs + LESSON_AT_START_LATE_MS - 2 * 60 * MS;
}

export function isScheduledLessonEndWindowClosing(
  requestedStartDate: Date | string | null | undefined,
  duration: LessonDuration,
  nowMs = Date.now(),
): boolean {
  const startMs = resolveLessonStartMs(requestedStartDate);
  if (startMs == null) return false;
  const endMs = startMs + durationHours(duration) * 60 * 60 * MS;
  return nowMs >= endMs + LESSON_END_GRACE_AFTER_MS - 2 * 60 * MS;
}

export function isLessonEndWindowClosing(
  lessonStartedAt: Date | string | null | undefined,
  duration: LessonDuration,
  nowMs = Date.now(),
): boolean {
  if (!lessonStartedAt) return false;
  const started = new Date(lessonStartedAt);
  if (!Number.isFinite(started.getTime())) return false;
  const endMs = expectedLessonEndMs(started, duration);
  return nowMs >= endMs + LESSON_END_GRACE_AFTER_MS - 2 * 60 * MS;
}
