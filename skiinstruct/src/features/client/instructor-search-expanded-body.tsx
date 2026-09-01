"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Award, CalendarDays, Languages, ShieldCheck } from "lucide-react";
import { useState, useEffect, type Dispatch, type SetStateAction } from "react";

import type { ClientInstructorProfileInstructor } from "@/features/client/instructor-profile-types";
import { instructorExpandedAvatar } from "@/features/client/instructor-profile-utils";
import {
  formatDrivingSchoolDetailsSummary,
  isAutoInstructorLabel,
} from "@/lib/auto-instructor-offer";
import type { InstructorPublicBusyWeek } from "@/shared/lib/instructor-schedule-types";
import { instructorPublicPath } from "@/lib/instructor-profile-slug";
import { isSyntheticInstructorBioLine } from "@/lib/services/instructor-match";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { InstructorPhoto } from "@/shared/ui/instructor-photo";
import type { PhotoViewerState } from "@/shared/ui/photo-viewer-overlay";

/** day: 0=Вс … 6=Сб — отображение с понедельника */
const WEEK_DAYS: { day: number; label: string }[] = [
  { day: 1, label: "Пн" },
  { day: 2, label: "Вт" },
  { day: 3, label: "Ср" },
  { day: 4, label: "Чт" },
  { day: 5, label: "Пт" },
  { day: 6, label: "Сб" },
  { day: 0, label: "Вс" },
];

/** Раскрытый профиль: порядок секций и подписи как в анкете инструктора («Профиль для клиентов»). */
export function InstructorSearchExpandedBody({
  instructor,
  listItemId,
  showAllReviewsFor,
  setShowAllReviewsFor,
  setPhotoPreview,
  setSelectedId,
  onStartCheckout,
}: {
  instructor: ClientInstructorProfileInstructor;
  listItemId: string;
  showAllReviewsFor: string | null;
  setShowAllReviewsFor: Dispatch<SetStateAction<string | null>>;
  setPhotoPreview: Dispatch<SetStateAction<PhotoViewerState | null>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  onStartCheckout: (instructorId: string) => void;
}) {
  const ins = instructor;
  const p = ins.profile;
  const avatarUrl = instructorExpandedAvatar(ins);
  const bioTrim = p.bio?.trim() ?? "";
  const categoryLabel =
    p.certifications.filter(Boolean).join(", ").trim() || p.certificationLevel?.trim() || "";
  const showBioSection =
    Boolean(bioTrim) && !isSyntheticInstructorBioLine(p.bio, p.specializations);
  const gallery = p.photoGallery.filter((ph) => ph?.trim());
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);

  useEffect(() => {
    setSelectedWeekday(null);
  }, [listItemId]);

  const busyWeekQuery = useQuery({
    queryKey: ["instructor-public-busy-week", listItemId],
    queryFn: async () => {
      const r = await fetch(`/api/instructors/${listItemId}/schedule`, { cache: "no-store" });
      if (!r.ok) throw new Error("schedule");
      const j = (await r.json()) as { schedule: InstructorPublicBusyWeek };
      return j.schedule;
    },
    staleTime: 60_000,
  });

  const selectedBusyDay =
    selectedWeekday == null
      ? null
      : (busyWeekQuery.data?.days.find((d) => d.weekday === selectedWeekday) ?? null);
  const selectedTemplateSlots =
    selectedWeekday == null
      ? []
      : p.availabilitySlots.filter((s) => s.day === selectedWeekday && s.busy !== true);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-border bg-muted">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Фото
            </div>
            {avatarUrl ? (
              <InstructorPhoto
                src={avatarUrl}
                alt={ins.name ?? "Инструктор"}
                size={48}
                className="relative z-[1] h-full w-full"
              />
            ) : null}
          </div>
          <div>
            <p className="text-base font-semibold">{ins.name}</p>
            <p className="text-xs text-muted-foreground">
              {categoryLabel ? (
                <>
                  <span className="font-medium text-foreground">Категория · </span>
                  {categoryLabel}
                </>
              ) : null}
              {p.isOnline ? (
                <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  на линии
                </span>
              ) : null}
            </p>
            {p.workDistrict ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Район работы · </span>
                {p.workDistrict}
              </p>
            ) : null}
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

      <div className={cn("grid gap-2", categoryLabel ? "md:grid-cols-2" : "")}>
        {categoryLabel ? (
          <div className="rounded-md bg-muted/60 p-2 text-xs">
            <p className="inline-flex items-center gap-1 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              Категория
            </p>
            <p className="mt-1">{categoryLabel}</p>
          </div>
        ) : null}
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

      {gallery.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium">Фотографии инструктора</p>
          <div className="flex flex-wrap gap-2">
            {gallery.map((ph, ix) => (
              <button
                type="button"
                key={`${ph}-${ix}`}
                className="h-20 w-20 overflow-hidden rounded-md border border-border"
                onClick={() => setPhotoPreview({ urls: gallery, index: ix })}
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
        <p className="text-[11px] text-muted-foreground">
          Нажмите на день, чтобы увидеть занятые часы на этой неделе
        </p>
        <div className="grid gap-1 rounded-md border border-border p-2 text-[11px] md:grid-cols-7">
          {WEEK_DAYS.map(({ day, label }) => {
            const slots = p.availabilitySlots.filter((s) => s.day === day);
            const dayBusy = busyWeekQuery.data?.days.find((d) => d.weekday === day);
            const hasBusy = Boolean(dayBusy?.busyRanges.length);
            const selected = selectedWeekday === day;
            return (
              <button
                type="button"
                key={label}
                className={cn(
                  "rounded border border-border p-1 text-left transition-colors",
                  selected
                    ? "border-sky-500 bg-sky-50 ring-1 ring-sky-400"
                    : "hover:border-sky-300 hover:bg-muted/40",
                )}
                aria-pressed={selected}
                aria-label={`${label}: показать занятые часы`}
                onClick={() => setSelectedWeekday((prev) => (prev === day ? null : day))}
              >
                <div className="flex items-center justify-between gap-1 font-medium">
                  <span>{label}</span>
                  {hasBusy ? (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500"
                      title="Есть занятые часы"
                      aria-hidden
                    />
                  ) : null}
                </div>
                {!slots.length ? (
                  <div className="mt-1 text-muted-foreground">—</div>
                ) : (
                  <div className="mt-1 space-y-1">
                    {slots.slice(0, 3).map((s, ix) => (
                      <div
                        key={`${label}-${ix}`}
                        className={`rounded px-1 py-0.5 ${
                          s.busy ? "bg-muted text-muted-foreground" : "bg-sky-100 text-sky-900"
                        }`}
                      >
                        {s.from}-{s.to}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedWeekday != null ? (
          <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2 text-xs">
            <p className="font-medium">
              {WEEK_DAYS.find((d) => d.day === selectedWeekday)?.label}
              {selectedBusyDay
                ? ` · ${new Date(`${selectedBusyDay.ymd}T12:00:00`).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}`
                : null}
            </p>
            <div>
              <p className="text-[11px] text-muted-foreground">Рабочие часы</p>
              {!selectedTemplateSlots.length ? (
                <p className="mt-0.5 text-muted-foreground">Выходной / нет слотов</p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {selectedTemplateSlots.map((s, ix) => (
                    <li
                      key={`avail-${ix}`}
                      className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-900"
                    >
                      {s.from}–{s.to}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Занято на этой неделе</p>
              {busyWeekQuery.isLoading ? (
                <p className="mt-0.5 text-muted-foreground">Загрузка…</p>
              ) : busyWeekQuery.isError ? (
                <p className="mt-0.5 text-destructive">Не удалось загрузить занятость</p>
              ) : !selectedBusyDay?.busyRanges.length ? (
                <p className="mt-0.5 text-muted-foreground">Свободно — записей нет</p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {selectedBusyDay.busyRanges.map((r, ix) => (
                    <li
                      key={`busy-${ix}`}
                      className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-900"
                    >
                      {r.from}–{r.to}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
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
              <Link href={`${instructorPublicPath({ id: listItemId, profileSlug: instructor.profileSlug, nickname: instructor.nickname })}/reviews?sort=date_desc`}>Все отзывы (страница)</Link>
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
