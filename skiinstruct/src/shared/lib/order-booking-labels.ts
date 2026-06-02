import type { LessonDuration, SkillLevel } from "@prisma/client";

import { lessonDurationLabelRu } from "@/shared/lib/order-duration";

const SKILL_LEVEL_LABEL_RU: Record<SkillLevel, string> = {
  BEGINNER: "Начинающий",
  INTERMEDIATE: "Средний",
  ADVANCED: "Продвинутый",
};

export function skillLevelLabelRu(level: SkillLevel | string | null | undefined): string {
  if (!level || !(level in SKILL_LEVEL_LABEL_RU)) return "—";
  return SKILL_LEVEL_LABEL_RU[level as SkillLevel];
}

export { lessonDurationLabelRu };

/** Пожелания клиента без служебных строк (дисциплина, окно времени, ETA). */
export function extractClientWishNotes(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  const kept = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();
      return (
        !lower.startsWith("дисциплина:") &&
        !lower.startsWith("время:") &&
        !lower.startsWith("eta инструктора:") &&
        !lower.startsWith("желаемые даты урока:") &&
        !lower.startsWith("желаемая длительность курса:")
      );
    });
  const text = kept.join("\n").trim();
  return text || null;
}
