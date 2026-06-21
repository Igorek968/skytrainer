"use client";

import Link from "next/link";
import { Award, CalendarDays, Languages, ShieldCheck } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import type { ClientInstructorProfileInstructor } from "@/features/client/instructor-profile-types";
import { instructorExpandedAvatar } from "@/features/client/instructor-profile-utils";
import {
  formatDrivingSchoolDetailsSummary,
  isAutoInstructorLabel,
} from "@/lib/auto-instructor-offer";
import { isSyntheticInstructorBioLine } from "@/lib/services/instructor-match";
import { Button } from "@/shared/ui/button";
import { InstructorPhoto } from "@/shared/ui/instructor-photo";

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

/** Раскрытый профиль: порядок секций и подписи как в анкете инструктора («Профиль для клиентов»). */
export function InstructorSearchExpandedBody({
  instructor,
  listItemId,
  showAllReviewsFor,
  setShowAllReviewsFor,
  setPreviewUrl,
  setSelectedId,
  onStartCheckout,
}: {
  instructor: ClientInstructorProfileInstructor;
  listItemId: string;
  showAllReviewsFor: string | null;
  setShowAllReviewsFor: Dispatch<SetStateAction<string | null>>;
  setPreviewUrl: Dispatch<SetStateAction<string | null>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  onStartCheckout: (instructorId: string) => void;
}) {
  const ins = instructor;
  const p = ins.profile;
  const avatarUrl = instructorExpandedAvatar(ins);
  const bioTrim = p.bio?.trim() ?? "";
  const showBioSection =
    Boolean(bioTrim) && !isSyntheticInstructorBioLine(p.bio, p.specializations);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-border bg-muted">
            {avatarUrl ? (
              <InstructorPhoto
                src={avatarUrl}
                alt={ins.name ?? "Инструктор"}
                size={48}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                Фото
              </div>
            )}
          </div>
          <div>
            <p className="text-base font-semibold">{ins.name}</p>
            <p className="text-xs text-muted-foreground">
              {p.certificationLevel?.trim() ? (
                <>
                  <span className="font-medium text-foreground">Сертификация · </span>
                  {p.certificationLevel}
                </>
              ) : (
                "Сертификация не указана"
              )}
            </p>
          </div>
        </div>
        <div className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
          {p.hourlyRate} ₽/час
        </div>
      </div>

      <div className="rounded-md bg-muted/60 p-2 text-xs">
        <p className="font-medium">Опыт</p>
        <p className="mt-1">
          <span className="text-muted-foreground">Возраст · </span>
          {p.age ?? "—"}
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="text-muted-foreground">Стаж инструктора · </span>
          {p.experienceYears ?? "—"}
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="text-muted-foreground">Стаж в спорте · </span>
          {p.sportsExperienceYears ?? "—"}
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="text-muted-foreground">Занятий по направлению · </span>
          {p.totalLessons ?? "—"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          На платформе: завершено {ins.stats.completedLessons}, часов по завершённым заказам{" "}
          {ins.stats.taughtHours}
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md bg-muted/60 p-2 text-xs">
          <p className="inline-flex items-center gap-1 font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ключевые сертификаты
          </p>
          <p className="mt-1">
            {p.certifications.length
              ? p.certifications.join(", ")
              : p.certificationLevel?.trim() || "Не указано"}
          </p>
        </div>
        <div className="rounded-md bg-muted/60 p-2 text-xs">
          <p className="inline-flex items-center gap-1 font-medium">
            <Award className="h-3.5 w-3.5" />
            Уровни подготовки
          </p>
          <p className="mt-1">{p.skillLevels.length ? p.skillLevels.join(", ") : "Не указано"}</p>
        </div>
      </div>

      <div className="rounded-md bg-muted/60 p-2 text-xs">
        <p className="inline-flex items-center gap-1 font-medium">
          <Languages className="h-3.5 w-3.5" />
          Языки
        </p>
        <p className="mt-1">{p.languages.length ? p.languages.join(", ") : "Не указано"}</p>
      </div>

      <div className="rounded-md bg-muted/60 p-2 text-xs">
        <p className="font-medium">Специализации</p>
        <p className="mt-1">{p.specializations.length ? p.specializations.join(", ") : "Не указано"}</p>
      </div>

      {(() => {
        const autoOffer = p.specializationOffers?.find((o) => isAutoInstructorLabel(o.label));
        if (!autoOffer?.drivingDetails) return null;
        return (
          <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
            <p className="font-medium">Автоинструктор</p>
            <p className="mt-1 text-muted-foreground">
              {formatDrivingSchoolDetailsSummary(autoOffer.drivingDetails)}
            </p>
            <p className="mt-1">
              Ставка: <strong className="text-foreground">{autoOffer.hourlyRate} ₽/ч</strong>
            </p>
          </div>
        );
      })()}

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md bg-muted/60 p-2 text-xs">
          <p className="font-medium">Дополнительные услуги</p>
          <p className="mt-1">
            {p.additionalServices.length ? p.additionalServices.join(", ") : "Не указано"}
          </p>
        </div>
        <div className="rounded-md bg-muted/60 p-2 text-xs">
          <p className="font-medium">Длительности занятия</p>
          <p className="mt-1">{p.offeredDurations.length ? p.offeredDurations.join(", ") : "Не указано"}</p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium">Лучшие достижения</p>
        {ins.achievements.length ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {ins.achievements.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Не указано</p>
        )}
      </div>

      {p.photoGallery.some((ph) => ph?.trim()) ? (
        <div className="space-y-1">
          <p className="text-xs font-medium">Фотографии инструктора</p>
          <div className="flex flex-wrap gap-2">
            {p.photoGallery
              .filter((ph) => ph?.trim())
              .map((ph, ix) => (
                <button
                  type="button"
                  key={`${ph}-${ix}`}
                  className="h-20 w-20 overflow-hidden rounded-md border border-border"
                  onClick={() => setPreviewUrl(ph)}
                  aria-label={`Открыть фото ${ix + 1}`}
                >
                  <InstructorPhoto
                    src={ph}
                    alt={`Фото инструктора ${ix + 1}`}
                    size={80}
                    className="h-full w-full"
                  />
                </button>
              ))}
          </div>
        </div>
      ) : null}

      {showBioSection ? (
        <div className="space-y-1">
          <p className="text-xs font-medium">Биография и достижения</p>
          <p className="text-sm text-muted-foreground">{bioTrim}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="inline-flex items-center gap-1 text-xs font-medium">
          <CalendarDays className="h-3.5 w-3.5" />
          Календарь доступности
        </p>
        <div className="grid gap-1 rounded-md border border-border p-2 text-[11px] md:grid-cols-7">
          {DAY_LABELS.map((d, idx) => {
            const slots = p.availabilitySlots.filter((s) => s.day === idx);
            return (
              <div key={d} className="rounded border border-border p-1">
                <div className="font-medium">{d}</div>
                {!slots.length ? (
                  <div className="mt-1 text-muted-foreground">—</div>
                ) : (
                  <div className="mt-1 space-y-1">
                    {slots.slice(0, 3).map((s, ix) => (
                      <div
                        key={`${d}-${ix}`}
                        className={`rounded px-1 py-0.5 ${
                          s.busy ? "bg-muted text-muted-foreground" : "bg-sky-100 text-sky-900"
                        }`}
                      >
                        {s.from}-{s.to}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium">Последние отзывы</p>
        {!ins.reviews.length ? (
          <p className="text-xs text-muted-foreground">Пока нет отзывов от учеников.</p>
        ) : (
          <ul className="space-y-1">
            {(showAllReviewsFor === listItemId ? ins.reviews : ins.reviews.slice(0, 3)).map((r) => (
              <li key={r.id} className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                <p className="font-medium">
                  ★ {r.rating ?? "—"} · {r.authorName ?? "Ученик"}
                </p>
                <p className="text-muted-foreground">{r.text || "Отзыв без текста"}</p>
              </li>
            ))}
          </ul>
        )}
        {ins.reviews.length > 3 ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setShowAllReviewsFor((prev) => (prev === listItemId ? null : listItemId))
              }
            >
              {showAllReviewsFor === listItemId ? "Скрыть отзывы" : "Показать все в карточке"}
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={`/instructors/${listItemId}/reviews?sort=date_desc`}>Все отзывы (страница)</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => {
          setSelectedId(listItemId);
          onStartCheckout(listItemId);
        }}
      >
        Выбрать инструктора для заказа
      </Button>
    </>
  );
}
