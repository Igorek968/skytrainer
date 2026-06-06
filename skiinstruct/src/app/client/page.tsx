"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, getSession } from "next-auth/react";
import { Suspense, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { ChevronDown, Star, Award, ShieldCheck, CalendarDays, Languages } from "lucide-react";

import { PersonalDataDialog } from "@/features/client/personal-data-dialog";
import { ClientOrderCheckoutDialog } from "@/features/client/client-order-checkout-dialog";
import { ClientEventsFeed } from "@/features/orders/client-events-feed";
import { GeolocationPermissionDialog } from "@/features/map/geolocation-permission-dialog";
import { MeetAddressSearch } from "@/features/map/meet-address-search";
import { BookingMapLazy } from "@/features/map/map-loader";
import { consumeOpenPersonalDataFlag } from "@/lib/client-personal-data-storage";
import { locateUserMeetPoint, useMeetPoint } from "@/features/map/use-client-meet-point";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { TimeInput24, normalizeTimeInput24 } from "@/shared/ui/time-input-24";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  clearPendingCheckout,
  readPendingCheckout,
  savePendingCheckout,
} from "@/lib/client-pending-checkout";
import {
  formatDrivingSchoolDetailsSummary,
  isAutoInstructorLabel,
} from "@/lib/auto-instructor-offer";
import type { SpecializationOffer } from "@/lib/instructor-specialization-offers";
import { INSTRUCTOR_ACTIVITY_LABELS, isSyntheticInstructorBioLine } from "@/lib/services/instructor-match";
import { cn } from "@/lib/utils";
import type { LessonDuration } from "@prisma/client";
import { URGENT_INSTRUCTOR_DEADLINE_MIN } from "@/shared/lib/order-flex";
import {
  buildLessonBookingPreview,
  defaultLessonTimeWindow,
  earliestBookableStartHm,
  lessonEndHmFromStartAndDuration,
  LESSON_BOOKING_MIN_LEAD_MINUTES,
  localTodayYmd,
  minutesToHm,
} from "@/shared/lib/lesson-booking-time";
import { lessonDurationLabelRu } from "@/shared/lib/order-duration";
import { SectionErrorBoundary } from "@/shared/ui/section-error-boundary";

function currentLocalTimeHm(): string {
  const now = new Date();
  return minutesToHm(now.getHours() * 60 + now.getMinutes());
}

function normalizeHm(value: string): string {
  return value.trim().match(/^(\d{2}:\d{2})/)?.[1] ?? value.trim();
}

/** В Docker dev отключите опрос через NEXT_PUBLIC_DISABLE_NEARBY_POLL=1 (см. docker-compose.yml). */
const disableNearbyPoll = process.env.NEXT_PUBLIC_DISABLE_NEARBY_POLL === "1";

type NearbyResponse = {
  instructors: {
    id: string;
    name: string | null;
    image: string | null;
    photoUrl?: string | null;
    age?: number | null;
    isOnline?: boolean;
    hourlyRate: number;
    lessonsForDiscipline?: number | null;
    ratingAvg: number;
    reviewCount: number;
    languages: string[];
    specializations: string[];
    distanceKm: number;
    lat: number | null;
    lng: number | null;
  }[];
};

type InstructorProfileResponse = {
  instructor: {
    id: string;
    name: string | null;
    image: string | null;
    profile: {
      bio: string | null;
      photoUrl: string | null;
      photoGallery: string[];
      certificationLevel: string | null;
      certifications: string[];
      skillLevels: string[];
      languages: string[];
      specializations: string[];
      specializationOffers?: SpecializationOffer[];
      additionalServices: string[];
      offeredDurations: string[];
      availabilitySlots: { day: number; from: string; to: string; busy?: boolean }[];
      age: number | null;
      experienceYears: number | null;
      sportsExperienceYears: number | null;
      totalLessons: number | null;
      hourlyRate: number;
      ratingAvg: number;
      reviewCount: number;
    };
    stats: {
      completedLessons: number;
      taughtHours: number;
    };
    achievements: string[];
    reviews: {
      id: string;
      rating: number | null;
      text: string | null;
      createdAt: string;
      authorName: string | null;
    }[];
  };
};

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const CLIENT_SECTION_IDS = {
  quickSearch: "client-quick-search",
  nearbyInstructors: "client-nearby-instructors",
  instructorReviews: "client-instructor-reviews",
  events: "client-events",
} as const;

function scrollToClientSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function firstNonEmptyGalleryUrl(urls: string[] | undefined | null): string | null {
  const hit = urls?.find((u) => typeof u === "string" && u.trim().length > 0);
  return hit?.trim() ?? null;
}

function instructorListAvatar(row: { photoUrl?: string | null; image?: string | null }): string | null {
  const p = row.photoUrl?.trim();
  const img = row.image?.trim();
  return (p && p.length > 0 ? p : null) ?? (img && img.length > 0 ? img : null);
}

function instructorExpandedAvatar(ins: InstructorProfileResponse["instructor"]): string | null {
  /** Совпадает с API: обложка (или объединённое превью), затем галерея, затем image аккаунта. */
  return (
    (ins.profile.photoUrl?.trim() || null) ??
    firstNonEmptyGalleryUrl(ins.profile.photoGallery) ??
    (ins.image?.trim() || null)
  );
}

/** Раскрытый профиль: порядок секций и подписи как в анкете инструктора («Профиль для клиентов»). */
function InstructorSearchExpandedBody({
  instructor,
  listItemId,
  showAllReviewsFor,
  setShowAllReviewsFor,
  setPreviewUrl,
  setSelectedId,
}: {
  instructor: InstructorProfileResponse["instructor"];
  listItemId: string;
  showAllReviewsFor: string | null;
  setShowAllReviewsFor: Dispatch<SetStateAction<string | null>>;
  setPreviewUrl: Dispatch<SetStateAction<string | null>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
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
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={ins.name ?? "Инструктор"} className="h-full w-full object-cover" />
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph} alt={`Фото инструктора ${ix + 1}`} className="h-full w-full object-cover" />
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

      <Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(listItemId)}>
        Выбрать инструктора для заказа
      </Button>

    </>
  );
}

/** После входа с /login?checkout=1 — снова открыть оформление с сохранённым инструктором. */
function ResumeCheckoutFromQuery({
  data,
  setSelectedId,
  setCheckoutInstructor,
  setCheckoutOpen,
}: {
  data: NearbyResponse | undefined;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setCheckoutInstructor: Dispatch<
    SetStateAction<{ id: string; name: string | null; hourlyRate: number } | null>
  >;
  setCheckoutOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const cardState = searchParams.get("card");
    if (cardState === "updated") {
      toast.success("Карта успешно привязана");
      router.replace("/client", { scroll: false });
      return;
    }
    if (cardState === "cancelled") {
      toast.message("Привязка карты отменена");
      router.replace("/client", { scroll: false });
      return;
    }
    if (cardState === "mock") {
      toast.success("Тестовый режим: карта считается привязанной");
      router.replace("/client", { scroll: false });
      return;
    }
    if (searchParams.get("checkout") !== "1") return;
    const pending = readPendingCheckout();
    if (!pending) {
      router.replace("/client", { scroll: false });
      return;
    }
    setSelectedId(pending.instructorId);
    const row = data?.instructors.find((i) => i.id === pending.instructorId);
    setCheckoutInstructor({
      id: pending.instructorId,
      name: row?.name ?? pending.instructorName,
      hourlyRate: row?.hourlyRate ?? pending.hourlyRate,
    });
    setCheckoutOpen(true);
    clearPendingCheckout();
    router.replace("/client", { scroll: false });
  }, [searchParams, router, data, setSelectedId, setCheckoutInstructor, setCheckoutOpen]);

  return null;
}

export default function ClientHomePage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const meetLat = useMeetPoint((s) => s.meetLat);
  const meetLng = useMeetPoint((s) => s.meetLng);
  const meetAddress = useMeetPoint((s) => s.meetAddress);
  const setMeet = useMeetPoint((s) => s.setMeet);

  const center = useMemo(() => [meetLat, meetLng] as [number, number], [meetLat, meetLng]);

  const todayIso = useMemo(() => localTodayYmd(), []);
  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return localTodayYmd(d);
  }, []);
  const maxLessonIso = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().slice(0, 10);
  }, []);
  const [skillLevel, setSkillLevel] = useState("INTERMEDIATE");
  const [duration, setDuration] = useState("TWO_HOURS");
  const [languagePref, setLanguagePref] = useState("Русский");
  const [specializationPref, setSpecializationPref] = useState("🎿 Горные лыжи");
  const [lessonDate, setLessonDate] = useState(todayIso);
  const [lessonEndDate, setLessonEndDate] = useState(todayIso);
  const [notes, setNotes] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Инструктор, поднятый в начало списка после двойного клика на карте. */
  const [listPriorityId, setListPriorityId] = useState<string | null>(null);
  const [showAllReviewsFor, setShowAllReviewsFor] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutInstructor, setCheckoutInstructor] = useState<{
    id: string;
    name: string | null;
    hourlyRate: number;
  } | null>(null);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [scheduleConflictOpen, setScheduleConflictOpen] = useState(false);
  const [scheduleConflictMessage, setScheduleConflictMessage] = useState("");
  /** Запись на дату: в списке — и офлайн; после оплаты без дедлайна ответа. */
  const [flexibleOfflineBooking, setFlexibleOfflineBooking] = useState(false);
  /** Срочный вызов: только онлайн, дедлайн на принятие после оплаты. */
  const [urgentBooking, setUrgentBooking] = useState(false);
  const [instructorNameQuery, setInstructorNameQuery] = useState("");

  useEffect(() => {
    if (consumeOpenPersonalDataFlag()) setPersonalOpen(true);
    const onOpenPersonal = () => setPersonalOpen(true);
    window.addEventListener("skiinstruct:open-personal", onOpenPersonal);
    return () => window.removeEventListener("skiinstruct:open-personal", onOpenPersonal);
  }, []);

  /** Быстрый поиск — сегодня; блок «Даты…» (заявка не день в день) — по умолчанию завтра. */
  useEffect(() => {
    if (!showAdvancedParams) {
      setLessonDate(todayIso);
      setLessonEndDate(todayIso);
      return;
    }
    setLessonDate((d) => (d <= todayIso ? tomorrowIso : d));
    setLessonEndDate((d) => (d <= todayIso ? tomorrowIso : d));
  }, [showAdvancedParams, todayIso, tomorrowIso]);

  const lessonDays = useMemo(() => {
    const start = new Date(`${lessonDate}T00:00:00`);
    const end = new Date(`${lessonEndDate}T00:00:00`);
    const raw = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return Math.min(30, Math.max(1, Number.isFinite(raw) ? raw : 1));
  }, [lessonDate, lessonEndDate]);
  /** Не «день в день»: в поиске — и офлайн; заявка без срочного дедлайна. */
  const isRelaxedLessonBooking = useMemo(
    () => flexibleOfflineBooking || lessonDate > todayIso || lessonDays > 1,
    [flexibleOfflineBooking, lessonDate, todayIso, lessonDays],
  );
  const urgentBookingAvailable = useMemo(
    () =>
      !showAdvancedParams ||
      (lessonDate === todayIso && lessonDays === 1 && !flexibleOfflineBooking),
    [showAdvancedParams, lessonDate, todayIso, lessonDays, flexibleOfflineBooking],
  );

  useEffect(() => {
    if (!urgentBookingAvailable && urgentBooking) setUrgentBooking(false);
  }, [urgentBookingAvailable, urgentBooking]);

  useEffect(() => {
    if (flexibleOfflineBooking && urgentBooking) setUrgentBooking(false);
  }, [flexibleOfflineBooking, urgentBooking]);
  // SSR/CSR must render identical initial clock values to avoid hydration mismatch.
  const [lessonStartTime, setLessonStartTime] = useState("10:00");
  const [lessonEndTime, setLessonEndTime] = useState("12:00");
  const [startTimeZoneHint, setStartTimeZoneHint] = useState<string | null>(null);
  const [userTimeZone, setUserTimeZone] = useState("местное время");
  /** Только на клиенте — иначе SSR (UTC) и браузер (MSK) дают разный текст и ломают hydration. */
  const [todayLeadLine, setTodayLeadLine] = useState<string | null>(null);
  const isOutdoorTour = specializationPref.includes("Пешие туры") || specializationPref.includes("Маунтибайк");

  const lessonDuration = duration as LessonDuration;

  const syncLessonEndTime = (startHm: string, dur: LessonDuration) => {
    setLessonEndTime(lessonEndHmFromStartAndDuration(normalizeHm(startHm), dur));
  };

  const refreshStartTimeZoneHint = () => {
    const now = new Date();
    setStartTimeZoneHint(
      `Сейчас ${now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · ${userTimeZone}`,
    );
  };

  useEffect(() => {
    setUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "местное время");
  }, []);

  const applyCurrentLessonStartTime = () => {
    const nowHm = currentLocalTimeHm();
    setLessonStartTime(nowHm);
    syncLessonEndTime(nowHm, lessonDuration);
    refreshStartTimeZoneHint();
  };

  useEffect(() => {
    const nowWindow = defaultLessonTimeWindow(undefined, "TWO_HOURS");
    setLessonStartTime(nowWindow.start);
    setLessonEndTime(nowWindow.end);
  }, []);

  const nearbyLessonDate = showAdvancedParams ? lessonDate : todayIso;
  const nearbyLessonEndDate = showAdvancedParams ? lessonEndDate : todayIso;
  const nearbyLessonDays = showAdvancedParams ? lessonDays : 1;

  useEffect(() => {
    const activeDate = showAdvancedParams ? lessonDate : todayIso;
    if (activeDate === localTodayYmd()) {
      setTodayLeadLine(
        `Сегодня ближайшее начало — с ${earliestBookableStartHm()} (не раньше чем через ${LESSON_BOOKING_MIN_LEAD_MINUTES} мин).`,
      );
    } else {
      setTodayLeadLine(null);
    }
  }, [showAdvancedParams, lessonDate, todayIso]);

  const nearbyRelaxed = useMemo(
    () =>
      !urgentBooking &&
      showAdvancedParams &&
      (flexibleOfflineBooking || lessonDate > todayIso || lessonDays > 1),
    [showAdvancedParams, flexibleOfflineBooking, lessonDate, todayIso, lessonDays, urgentBooking],
  );

  const quickSearchPreview = useMemo(
    () =>
      buildLessonBookingPreview({
        lessonDate: showAdvancedParams ? lessonDate : todayIso,
        lessonEndDate: showAdvancedParams ? lessonEndDate : todayIso,
        lessonStartTime,
        lessonEndTime,
        lessonDays: showAdvancedParams ? lessonDays : 1,
        duration: lessonDuration,
      }),
    [
      showAdvancedParams,
      lessonDate,
      lessonEndDate,
      lessonDays,
      todayIso,
      lessonStartTime,
      lessonEndTime,
      lessonDuration,
    ],
  );

  const nearbyLessonStartTime = normalizeHm(lessonStartTime);
  const nearbyLessonEndTime = normalizeHm(lessonEndTime);
  const nearbyTzOffset = new Date().getTimezoneOffset();

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: [
      "nearby",
      meetLat,
      meetLng,
      skillLevel,
      languagePref,
      specializationPref,
      duration,
      nearbyLessonDate,
      nearbyLessonEndDate,
      nearbyLessonDays,
      nearbyRelaxed,
      urgentBooking,
      nearbyLessonStartTime,
      nearbyLessonEndTime,
      nearbyTzOffset,
    ],
    queryFn: async () => {
      const offline = nearbyRelaxed ? "&includeOffline=1" : "";
      const timeParams = `&lessonStartTime=${encodeURIComponent(nearbyLessonStartTime)}&lessonEndTime=${encodeURIComponent(nearbyLessonEndTime)}&lessonTimeZoneOffsetMinutes=${nearbyTzOffset}`;
      const r = await fetch(
        `/api/instructors/nearby?lat=${meetLat}&lng=${meetLng}&skillLevel=${skillLevel}&languagePref=${encodeURIComponent(languagePref)}&specialization=${encodeURIComponent(specializationPref)}&duration=${duration}&lessonDate=${nearbyLessonDate}&lessonEndDate=${nearbyLessonEndDate}&lessonDays=${nearbyLessonDays}${timeParams}${offline}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error("nearby");
      return r.json() as Promise<NearbyResponse>;
    },
    /** Иначе после правок анкеты другим пользователем (клиент) долго видит старые имена/фото. */
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: !disableNearbyPoll,
    /** Пока открыта страница клиента — подтягиваем анкеты инструкторов без ручного «Обновить». */
    refetchInterval: disableNearbyPoll ? false : 12_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!dataUpdatedAt) return;
    void queryClient.invalidateQueries({ queryKey: ["instructor-profile"], exact: false });
  }, [dataUpdatedAt, queryClient]);

  const instructorsForList = useMemo(() => {
    let list = data?.instructors ?? [];
    if (listPriorityId) {
      const idx = list.findIndex((i) => i.id === listPriorityId);
      if (idx > 0) {
        const reordered = [...list];
        const [picked] = reordered.splice(idx, 1);
        reordered.unshift(picked);
        list = reordered;
      }
    }
    const q = instructorNameQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => (i.name ?? "").toLowerCase().includes(q));
  }, [data?.instructors, listPriorityId, instructorNameQuery]);

  function focusInstructorFromMap(id: string) {
    setListPriorityId(id);
    setSelectedId(id);
    setExpandedId(id);
    setShowAllReviewsFor(null);
    scrollToClientSection(CLIENT_SECTION_IDS.nearbyInstructors);
  }

  const { data: myInstructorReviews } = useQuery({
    queryKey: ["client-instructor-reviews"],
    enabled: session?.user?.role === "CLIENT",
    queryFn: async () => {
      const r = await fetch("/api/orders");
      if (!r.ok) throw new Error("orders");
      const j = (await r.json()) as {
        orders: Array<{
          id: string;
          status: string;
          createdAt: string;
          instructorRating: number | null;
          instructorReview: string | null;
          instructor: { name: string | null } | null;
        }>;
      };
      return j.orders
        .filter((o) => o.status === "COMPLETED" && o.instructorRating != null)
        .slice(0, 3);
    },
    staleTime: 30_000,
  });

  const router = useRouter();

  const {
    data: expandedProfile,
    isLoading: isExpandedProfileLoading,
    isError: isExpandedProfileError,
  } = useQuery({
    queryKey: ["instructor-profile", expandedId, specializationPref],
    enabled: Boolean(expandedId),
    queryFn: async () => {
      const disciplineQ = encodeURIComponent(specializationPref);
      const r = await fetch(
        `/api/instructors/${expandedId}?discipline=${disciplineQ}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error("profile");
      return r.json() as Promise<InstructorProfileResponse>;
    },
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: !disableNearbyPoll,
    refetchInterval: disableNearbyPoll || !expandedId ? false : 12_000,
    refetchIntervalInBackground: false,
  });

  async function postOrder(instructorId: string): Promise<string | null> {
    const disciplineLine = `Дисциплина: ${specializationPref}`;
    const notesLine = notes.trim();
    const mergedNotes = [disciplineLine, notesLine].filter(Boolean).join("\n");
    const address = meetAddress.trim();
    if (address.length < 3) {
      toast.error("Укажите место встречи (адрес на карте, не менее 3 символов)");
      return null;
    }

    const body = JSON.stringify({
      meetLat,
      meetLng,
      meetAddress: address,
      skillLevel,
      languagePref,
      duration,
      notes: mergedNotes || undefined,
      disciplineLabel: specializationPref,
      lessonDate: showAdvancedParams ? lessonDate : todayIso,
      lessonEndDate: showAdvancedParams ? lessonEndDate : todayIso,
      lessonDays: showAdvancedParams ? lessonDays : 1,
      lessonStartTime: (() => {
        const m = lessonStartTime.trim().match(/^(\d{2}:\d{2})/);
        return m ? m[1] : lessonStartTime;
      })(),
      lessonEndTime: (() => {
        const m = lessonEndTime.trim().match(/^(\d{2}:\d{2})/);
        return m ? m[1] : lessonEndTime;
      })(),
      lessonTimeZoneOffsetMinutes: new Date().getTimezoneOffset(),
      instructorId,
      flexibleInstructorInvite: nearbyRelaxed,
      urgentInvite: urgentBooking && urgentBookingAvailable,
    });

    const doPost = () =>
      fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body,
      });

    try {
      setSubmitting(true);
      let res = await doPost();
      if (res.status === 401) {
        await getSession();
        await new Promise((r) => setTimeout(r, 200));
        res = await doPost();
      }
      if (res.status === 401) {
        await getSession();
        await new Promise((r) => setTimeout(r, 400));
        res = await doPost();
      }
      const raw = await res.text();
      let payload: { error?: unknown; order?: { id: string } } = {};
      try {
        payload = raw ? (JSON.parse(raw) as typeof payload) : {};
      } catch {
        payload = {};
      }
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Сессия не подхватилась. Войдите снова в окне оформления.");
          return null;
        }
        const err = payload.error;
        const fallback =
          raw.trim().length > 0 && raw.trim().length < 400 && !raw.trim().startsWith("<")
            ? raw.trim().slice(0, 400)
            : "";
        const msg =
          typeof err === "string"
            ? err
            : fallback || "Не удалось создать заказ";
        if (res.status === 409) {
          setScheduleConflictMessage(msg);
          setScheduleConflictOpen(true);
          return null;
        }
        toast.error(msg);
        return null;
      }
      const j = payload;
      if (!j.order?.id) {
        toast.error("Ответ сервера без номера заказа. Обновите страницу и проверьте «Мои заказы».");
        return null;
      }
      return j.order.id;
    } catch {
      toast.error("Сеть недоступна. Проверьте соединение и повторите.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  function openCheckoutForSelected() {
    const targetInstructorId = selectedId ?? expandedId;
    if (!targetInstructorId) {
      toast.error("Выберите инструктора на карте или в списке");
      return;
    }
    if (meetAddress.trim().length < 3) {
      toast.error("Укажите место встречи на карте перед бронированием");
      return;
    }
    const row = data?.instructors.find((i) => i.id === targetInstructorId);
    const rate = row?.hourlyRate ?? expandedProfile?.instructor.profile.hourlyRate;
    const rateNum = typeof rate === "number" ? rate : Number(rate);
    const summary = {
      id: targetInstructorId,
      name: row?.name ?? expandedProfile?.instructor.name ?? null,
      hourlyRate: Number.isFinite(rateNum) ? rateNum : 0,
    };
    savePendingCheckout({
      instructorId: summary.id,
      instructorName: summary.name,
      hourlyRate: summary.hourlyRate,
    });
    setCheckoutInstructor(summary);
    setCheckoutOpen(true);
  }

  return (
    <div className="space-y-6">
      <GeolocationPermissionDialog />
      <Suspense fallback={null}>
        <ResumeCheckoutFromQuery
          data={data}
          setSelectedId={setSelectedId}
          setCheckoutInstructor={setCheckoutInstructor}
          setCheckoutOpen={setCheckoutOpen}
        />
      </Suspense>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Найти тренера рядом</h1>
            <p className="text-sm text-muted-foreground">
              Без регистрации: отметьте себя на карте, выберите направление и инструктора. После выбора — согласие с
              офертой, аккаунт и оплата картой, затем заявка уходит инструктору.
            </p>
          </div>
          {session?.user ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/client/orders">Мои заказы</Link>
              </Button>
            </div>
          ) : null}
        </div>
        <nav
          className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4"
          aria-label="Быстрый переход по разделам"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full px-2 text-xs sm:text-sm"
            onClick={() => scrollToClientSection(CLIENT_SECTION_IDS.quickSearch)}
          >
            Быстрый поиск
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full px-2 text-xs sm:text-sm"
            onClick={() => scrollToClientSection(CLIENT_SECTION_IDS.nearbyInstructors)}
          >
            Инструкторы рядом
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full px-2 text-xs sm:text-sm"
            onClick={() => scrollToClientSection(CLIENT_SECTION_IDS.instructorReviews)}
          >
            Отзывы инструкторов
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full px-2 text-xs sm:text-sm"
            onClick={() => scrollToClientSection(CLIENT_SECTION_IDS.events)}
          >
            Мероприятия
          </Button>
        </nav>
      </div>

      <div className="space-y-3">
        <MeetAddressSearch />
        <SectionErrorBoundary title="Карта временно недоступна">
          <BookingMapLazy
            interactive
            center={center}
            meetLat={meetLat}
            meetLng={meetLng}
            radiusKm={5}
            selectedInstructorId={selectedId}
            onInstructorSelect={(id) => setSelectedId(id)}
            onInstructorFocus={focusInstructorFromMap}
            instructors={(data?.instructors ?? [])
              .filter((i) => i.lat != null && i.lng != null)
              .map((i) => ({
                id: i.id,
                name: i.name,
                lat: i.lat as number,
                lng: i.lng as number,
                hourlyRate: i.hourlyRate,
                ratingAvg: i.ratingAvg,
                distanceKm: i.distanceKm,
                photoUrl: i.photoUrl,
                image: i.image,
              }))}
            onMeetChange={(lat, lng) => setMeet(lat, lng)}
            onLocateMe={locateUserMeetPoint}
          />
        </SectionErrorBoundary>
      </div>

      <div id={CLIENT_SECTION_IDS.events} className="scroll-mt-24">
        <SectionErrorBoundary title="Мероприятия временно недоступны">
          <ClientEventsFeed layout="carousel" />
        </SectionErrorBoundary>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card id={CLIENT_SECTION_IDS.quickSearch} className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Быстрый поиск</CardTitle>
            <CardDescription>Минимум полей — карта обновит список инструкторов в радиусе 5 км.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="specialization">Направление</Label>
              <select
                id="specialization"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={specializationPref}
                onChange={(e) => setSpecializationPref(e.target.value)}
              >
                {INSTRUCTOR_ACTIVITY_LABELS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill">Уровень</Label>
              <select
                id="skill"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
              >
                <option value="BEGINNER">Начинающий</option>
                <option value="INTERMEDIATE">Средний</option>
                <option value="ADVANCED">Продвинутый</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workout-start-time">Начало тренировки</Label>
              <div className="flex flex-wrap items-center gap-2">
                <TimeInput24
                  id="workout-start-time"
                  value={lessonStartTime}
                  onFocus={refreshStartTimeZoneHint}
                  onChange={(next) => {
                    setLessonStartTime(next);
                    const normalized = normalizeTimeInput24(next);
                    if (normalized) syncLessonEndTime(normalized, lessonDuration);
                  }}
                  className="min-w-[8.5rem] flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 shrink-0 px-2 text-xs"
                  onClick={applyCurrentLessonStartTime}
                >
                  Сейчас
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {startTimeZoneHint ??
                  `Время в вашем часовом поясе (${userTimeZone}). Нажмите на поле или иконку часов, чтобы выбрать время.`}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Длительность</Label>
              <select
                id="duration"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={duration}
                onChange={(e) => {
                  const next = e.target.value as LessonDuration;
                  setDuration(next);
                  syncLessonEndTime(lessonStartTime, next);
                }}
              >
                <option value="ONE_HOUR">1 час</option>
                <option value="TWO_HOURS">2 часа</option>
                <option value="HALF_DAY">Полдня</option>
                <option value="FULL_DAY">Весь день</option>
              </select>
            </div>
            {urgentBookingAvailable ? (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm transition-colors",
                  urgentBooking
                    ? "border-amber-500/60 bg-amber-500/15 shadow-sm"
                    : "border-border bg-muted/20",
                )}
              >
                <label htmlFor="urgent-booking" className="flex cursor-pointer items-start gap-3">
                  <input
                    id="urgent-booking"
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 rounded border-input accent-amber-600"
                    checked={urgentBooking}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setUrgentBooking(on);
                      if (on) {
                        applyCurrentLessonStartTime();
                      }
                    }}
                  />
                  <span className="leading-snug">
                    <span className="font-semibold text-foreground">⚡ Срочно — нужен инструктор сейчас</span>
                    <span className="mt-1 block text-muted-foreground">
                      Только инструкторы «на линии». После оплаты у выбранного{" "}
                      <strong>{URGENT_INSTRUCTOR_DEADLINE_MIN} минут</strong> на принятие — иначе полный
                      возврат.
                    </span>
                  </span>
                </label>
              </div>
            ) : null}
            <div
              className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed"
              aria-live="polite"
            >
              <p className="font-medium text-foreground">На что вы подписываетесь</p>
              <p className="mt-1 text-foreground">{quickSearchPreview.scheduleLine}</p>
              <p className="mt-1 text-muted-foreground">
                {showAdvancedParams ? (
                  <>
                    Окно занятия: <strong>{normalizeHm(lessonStartTime)}</strong>
                    {" — "}
                    <strong>{normalizeHm(lessonEndTime)}</strong>
                  </>
                ) : (
                  <>
                    Длительность: <strong>{lessonDurationLabelRu(lessonDuration)}</strong>
                    {" "}
                    · начало <strong>{normalizeHm(lessonStartTime)}</strong>
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{quickSearchPreview.tariffLine}</p>
              {todayLeadLine ? (
                <p className="mt-1 text-xs text-muted-foreground">{todayLeadLine}</p>
              ) : null}
              {urgentBooking ? (
                <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                  Режим «Срочно» активен — в списке ниже только инструкторы на линии.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAdvancedParams((v) => !v)}
            >
              {showAdvancedParams ? "Скрыть даты и комментарий" : "Даты, язык и комментарий"}
            </Button>
            {showAdvancedParams ? (
              <>
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
              <input
                id="flexible-offline"
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-input"
                checked={flexibleOfflineBooking}
                onChange={(e) => setFlexibleOfflineBooking(e.target.checked)}
              />
              <label htmlFor="flexible-offline" className="cursor-pointer text-sm leading-snug">
                <span className="font-medium">Запись на дату (инструктор может быть офлайн)</span>
                <span className="mt-1 block text-muted-foreground">
                  В списке появятся все подходящие инструкторы на выбранные даты; после оплаты выбранному
                  придёт уведомление <strong>без ограничения по времени</strong> на ответ.
                </span>
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-date">Дата начала</Label>
              <Input
                id="lesson-date"
                type="date"
                value={lessonDate}
                min={todayIso}
                max={maxLessonIso}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  setLessonDate(nextStart);
                  if (lessonEndDate < nextStart) {
                    setLessonEndDate(nextStart);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                {isRelaxedLessonBooking
                  ? lessonDate > todayIso || lessonDays > 1
                    ? "Урок не сегодня — в списке и офлайн-инструкторы; ответ без срочного дедлайна."
                    : "Даты можно выбрать вперёд на два года; фильтр по слотам календаря инструктора отключён."
                  : "На сегодня в списке только инструкторы «на линии» с подходящими слотами."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-start-time">Время начала (в день начала)</Label>
              <TimeInput24
                id="lesson-start-time"
                value={lessonStartTime}
                onFocus={refreshStartTimeZoneHint}
                onChange={(next) => {
                  setLessonStartTime(next);
                  const normalized = normalizeTimeInput24(next);
                  if (normalized) syncLessonEndTime(normalized, lessonDuration);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Когда в первый день периода вам удобно начать занятие с инструктором.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-end-date">Дата окончания</Label>
              <Input
                id="lesson-end-date"
                type="date"
                value={lessonEndDate}
                min={lessonDate}
                max={maxLessonIso}
                onChange={(e) => setLessonEndDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Количество дней аренды: {lessonDays}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-end-time">Время окончания (в день окончания)</Label>
              <TimeInput24
                id="lesson-end-time"
                value={lessonEndTime}
                onChange={setLessonEndTime}
              />
              <p className="text-xs text-muted-foreground">
                В последний день периода — до какого времени нужен инструктор. В один календарный день время
                окончания должно быть позже времени начала.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lang">Язык инструктора</Label>
              <Input id="lang" value={languagePref} onChange={(e) => setLanguagePref(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{isOutdoorTour ? "Пожелания по маршруту" : "Пожелания"}</Label>
              <textarea
                id="notes"
                className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  isOutdoorTour
                    ? "Например: предпочитаю лёгкий рельеф, без резких спусков..."
                    : "Например: акцент на технику карвинга и безопасное катание"
                }
              />
            </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card id={CLIENT_SECTION_IDS.nearbyInstructors} className="scroll-mt-24">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>
                {urgentBooking
                  ? "⚡ Срочно — инструкторы на линии"
                  : nearbyRelaxed
                    ? "Инструкторы"
                    : "Инструкторы рядом"}
              </CardTitle>
              <CardDescription className="max-w-xl">
                {urgentBooking
                  ? `Только «на линии»; после оплаты — ${URGENT_INSTRUCTOR_DEADLINE_MIN} мин на принятие.`
                  : nearbyRelaxed
                    ? "Включая офлайн; на карте — только с координатами."
                    : "Сегодня в списке только инструкторы «на линии»; данные обновляются каждые ~12 с."}
              </CardDescription>
              <Input
                type="search"
                value={instructorNameQuery}
                onChange={(e) => setInstructorNameQuery(e.target.value)}
                placeholder="Поиск инструктора по имени"
                className="mt-2 h-9 max-w-md"
                aria-label="Поиск инструктора по имени"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void refetch();
                if (expandedId) {
                  void queryClient.invalidateQueries({ queryKey: ["instructor-profile", expandedId] });
                }
              }}
            >
              Обновить
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">Не удалось загрузить список</p>
            ) : !data?.instructors.length ? (
              <p className="text-sm text-muted-foreground">
                Нет подходящих инструкторов: совпадение по направлению, уровню и длительности.
                {nearbyRelaxed
                  ? " Сдвиньте маркер встречи или ослабьте фильтры."
                  : " На сегодня показываются только инструкторы «на линии» (до ~100 км). Выберите дату позже или включите «Запись на дату» — тогда появятся и офлайн."}
              </p>
            ) : !instructorsForList.length ? (
              <p className="text-sm text-muted-foreground">
                По запросу «{instructorNameQuery.trim()}» никого не найдено. Попробуйте другое имя или очистите поиск.
              </p>
            ) : (
              <ul className="space-y-2" aria-label="Список инструкторов">
                {instructorsForList.map((i) => {
                  const rowAvatar = instructorListAvatar(i);
                  const expandedIns =
                    expandedId === i.id &&
                    expandedProfile &&
                    expandedProfile.instructor.id === expandedId &&
                    expandedProfile.instructor.id === i.id
                      ? expandedProfile.instructor
                      : null;
                  return (
                  <li key={i.id}>
                    <div
                      className={`rounded-lg border bg-gradient-to-br from-sky-50/70 to-background p-3 text-sm transition-colors dark:from-slate-900 ${
                        selectedId === i.id ? "border-accent ring-1 ring-accent" : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="flex flex-1 items-center justify-between gap-3 text-left"
                          onClick={() => setSelectedId(i.id)}
                        >
                          <span className="flex items-center gap-3">
                            <span className="h-10 w-10 overflow-hidden rounded-full border border-border bg-muted">
                              {rowAvatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={rowAvatar}
                                  alt={i.name ?? "Инструктор"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                  Фото
                                </span>
                              )}
                            </span>
                            <span>
                              <span className="block font-medium">
                                {i.name || "Имя Фамилия не указаны"}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                Возраст: {i.age ?? "—"}
                                {i.isOnline === false ? (
                                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    офлайн
                                  </span>
                                ) : null}
                                {i.distanceKm >= 9000 ? (
                                  <span className="ml-2 text-[10px] text-muted-foreground">нет координат</span>
                                ) : null}
                              </span>
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            {i.distanceKm >= 9000 ? "—" : `${i.distanceKm} км`}
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Показать полный профиль"
                          onClick={() =>
                            setExpandedId((prev) => {
                              const next = prev === i.id ? null : i.id;
                              if (next) setSelectedId(next);
                              if (next !== i.id) setShowAllReviewsFor(null);
                              return next;
                            })
                          }
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              expandedId === i.id ? "rotate-180" : ""
                            }`}
                          />
                        </Button>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{i.hourlyRate} ₽/час</span>
                        {i.lessonsForDiscipline != null ? (
                          <span>· {i.lessonsForDiscipline} занятий по направлению</span>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {i.ratingAvg.toFixed(1)} ({i.reviewCount})
                        </span>
                        <span>
                          <span className="font-medium text-foreground">Языки · </span>
                          {i.languages.length ? i.languages.join(", ") : "—"}
                        </span>
                      </div>
                      {i.specializations.length ? (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">Специализации · </span>
                          {i.specializations.join(", ")}
                        </div>
                      ) : null}

                      {expandedId === i.id ? (
                        <div className="mt-3 space-y-3 rounded-md border border-border bg-background/90 p-3">
                          {isExpandedProfileError ? (
                            <p className="text-sm text-destructive">
                              Не удалось загрузить профиль. Нажмите «Обновить» выше или разверните карточку ещё раз.
                            </p>
                          ) : isExpandedProfileLoading || !expandedIns ? (
                            <Skeleton className="h-28 w-full" />
                          ) : (
                            <InstructorSearchExpandedBody
                              instructor={expandedIns}
                              listItemId={i.id}
                              showAllReviewsFor={showAllReviewsFor}
                              setShowAllReviewsFor={setShowAllReviewsFor}
                              setPreviewUrl={setPreviewUrl}
                              setSelectedId={setSelectedId}
                            />
                          )}
                                </div>
                              ) : null}
                                </div>
                  </li>
                                    );
                                  })}
              </ul>
            )}

            <Button
              className="w-full"
              variant="accent"
              type="button"
              disabled={submitting || (!selectedId && !expandedId)}
              onClick={() => openCheckoutForSelected()}
            >
              Забронировать выбранного
            </Button>
          </CardContent>
        </Card>

        <Card id={CLIENT_SECTION_IDS.instructorReviews} className="scroll-mt-24 md:col-span-2">
            <CardHeader>
              <CardTitle>Отзывы инструкторов о вас</CardTitle>
              <CardDescription>Показываются после завершения обучения.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!myInstructorReviews?.length ? (
                <p className="text-sm text-muted-foreground">Пока нет отзывов от инструкторов.</p>
              ) : (
                <ul className="space-y-2">
                  {myInstructorReviews.slice(0, 3).map((r) => (
                    <li key={r.id} className="rounded-md border border-border bg-muted/30 p-2 text-sm">
                      <p className="font-medium">
                        ★ {r.instructorRating}/5 · {r.instructor?.name ?? "Инструктор"}
                      </p>
                      <p className="text-muted-foreground">{r.instructorReview || "Без текста"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
      </div>

      <PersonalDataDialog open={personalOpen} onOpenChange={setPersonalOpen} />

      <ClientOrderCheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        instructor={checkoutInstructor}
        onCreateOrder={async () => {
          const id = checkoutInstructor?.id ?? selectedId ?? expandedId;
          if (!id) {
            toast.error("Не выбран инструктор");
            return null;
          }
          return postOrder(id);
        }}
      />

      {scheduleConflictOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="schedule-conflict-title"
        >
          <div className="w-full max-w-md rounded-lg border border-destructive/40 bg-background p-5 shadow-lg">
            <h2 id="schedule-conflict-title" className="text-lg font-semibold text-destructive">
              Часы заняты
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {scheduleConflictMessage ||
                "На выбранную дату и время у инструктора уже есть запись. Поменяйте часы тренировки."}
            </p>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => setScheduleConflictOpen(false)}>
                Понятно
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фото инструктора"
        >
          <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Фото инструктора"
              className="max-h-[90vh] max-w-[90vw] rounded-lg border border-white/20 object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

