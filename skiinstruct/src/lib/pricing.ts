import { LessonDuration } from "@prisma/client";

export function durationHours(d: LessonDuration): number {
  switch (d) {
    case "ONE_HOUR":
      return 1;
    case "TWO_HOURS":
      return 2;
    case "HALF_DAY":
      return 4;
    case "FULL_DAY":
      return 8;
    default: {
      const _exhaustive: never = d;
      return _exhaustive;
    }
  }
}

export function computeTotals(params: {
  hourlyRate: number;
  duration?: LessonDuration;
  hours?: number;
  platformFeePercent: number;
}) {
  const hours =
    params.hours != null
      ? Math.max(0.5, params.hours)
      : params.duration != null
        ? durationHours(params.duration)
        : 1;
  const subtotal = params.hourlyRate * hours;
  const fee = Math.round((subtotal * params.platformFeePercent) / 100);
  const instructorShare = subtotal - fee;
  return {
    hours,
    subtotal,
    platformFee: fee,
    instructorShare,
    total: subtotal,
  };
}
