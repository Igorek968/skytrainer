"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Star, X } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

import { useThrottledInstructorLocation } from "@/features/geolocation/use-throttled-instructor-location";
import { devPollInterval } from "@/lib/query-poll";
import { InstructorComplianceCard } from "@/features/instructor/instructor-compliance-card";
import { InstructorPayoutPanel } from "@/features/instructor/instructor-payout-panel";
import { InstructorEventsEditor } from "@/features/instructor/instructor-events-editor";
import { enableInstructorOfflineAlerts } from "@/features/instructor/instructor-panel-shell";
import { InstructorWeekScheduleCalendar } from "@/features/instructor/instructor-week-schedule-calendar";
import {
  normalizeAvailabilitySlots,
  validateAvailabilitySlots,
  type AvailabilitySlot,
} from "@/shared/lib/instructor-availability-slots";
import { SpecializationOffersEditor } from "@/features/instructor/specialization-offers-editor";
import { isAutoInstructorLabel, validateDrivingSchoolDetails } from "@/lib/auto-instructor-offer";
import {
  parseSpecializationOffers,
  type SpecializationOffer,
} from "@/lib/instructor-specialization-offers";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";
import { INSTRUCTOR_ACTIVITY_LABELS } from "@/lib/services/instructor-match";

const instructorFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, credentials: "include" });

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (typeof window === "undefined") return file;

  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const targetW = Math.max(1, Math.round(bitmap.width * scale));
  const targetH = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = outType === "image/jpeg" ? 0.82 : 0.9;
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), outType, quality)
  );
  if (!blob) return file;

  const newName = file.name.replace(/\.\w+$/, outType === "image/png" ? ".png" : ".jpg");
  const compressed = new File([blob], newName, { type: outType, lastModified: Date.now() });
  return compressed.size < file.size ? compressed : file;
}

const CERTIFICATION_LEVEL_OPTIONS = [
  "ISIA Level 1",
  "ISIA Level 2",
  "ISIA Level 3",
  "CASI Level 1",
  "CASI Level 2",
  "Austrian Ski Instructor",
  "Canadian Ski Instructors’ Alliance",
];
const SKILL_LEVEL_OPTIONS = ["Для начинающих", "Средний", "Продвинутый", "Эксперт"];
const LANGUAGE_OPTIONS = ["Русский", "English", "Deutsch", "Français", "Italiano"];
const SERVICE_OPTIONS = [
  "Аренда инвентаря",
  "Трансфер к месту встречи",
  "Видеоразбор техники",
  "Фотосъёмка на склоне",
];
const DURATION_OPTIONS = ["1 ч", "1.5 ч", "2 ч", "Полдня", "День"];
const INSTRUCTOR_PANEL_SECTIONS = [
  { id: "lesson-schedule", label: "Календарь" },
  { id: "profile", label: "Профиль инструктора" },
  { id: "events", label: "Мероприятия" },
  { id: "compliance", label: "Соответствие и выплаты" },
  { id: "finance", label: "Финансы" },
  { id: "reviews", label: "Отзывы о клиентах" },
] as const;

function scrollToInstructorSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type ProfileField =
  | "certificationLevel"
  | "languagesRaw"
  | "specializationOffers"
  | "age"
  | "availabilityRaw";

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toCsv(values: string[]): string {
  return values.join(", ");
}

/** Строка «Инструкторка: …» из сида должна обновляться при смене чипов, иначе в БД уходят новые специализации и старое описание. */
function syncSeedLikeBioFromSpecsCsv(prevBio: string, nextSpecsCsv: string): string {
  const t = prevBio.trim();
  const specsList = parseCsv(nextSpecsCsv).join(", ");
  if (t.startsWith("Инструкторка:")) return `Инструкторка: ${specsList}`;
  if (t.startsWith("Инструктор:")) return `Инструктор: ${specsList}`;
  return prevBio;
}

function MultiSelectChipsField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: string[];
  placeholder: string;
  error?: string;
}) {
  const selected = parseCsv(value);
  const canAdd = options.filter((o) => !selected.includes(o));

  const add = (item: string) => {
    if (selected.includes(item)) return;
    onChange(toCsv([...selected, item]));
  };
  const remove = (item: string) => {
    onChange(toCsv(selected.filter((x) => x !== item)));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(error && "border-destructive ring-destructive")}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span
              key={`${id}-${item}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
            >
              {item}
              <button
                type="button"
                aria-label={`Удалить ${item}`}
                onClick={() => remove(item)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {canAdd.length ? (
        <div className="flex flex-wrap gap-1.5">
          {canAdd.map((opt) => (
            <button
              key={`${id}-opt-${opt}`}
              type="button"
              onClick={() => add(opt)}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              + {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function InstructorHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const signedInAsOtherRole = Boolean(session?.user?.role && session.user.role !== "INSTRUCTOR");
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  const { data, isLoading, isError, error: profileLoadError } = useQuery({
    queryKey: ["io-online"],
    queryFn: async () => {
      const r = await instructorFetch("/api/instructor/me");
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) {
        const msg = typeof j.error === "string" ? j.error : "Не удалось загрузить профиль";
        throw new Error(msg);
      }
      return j as {
        isOnline: boolean;
        verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
        profileDraftStatus: "NONE" | "PENDING_REVIEW";
        profilePendingReview: boolean;
        profileDraftRejectNote: string | null;
        profileDraftRejectedAt: string | null;
        profile: {
          firstName: string;
          lastName: string;
          bio: string;
          certificationLevel: string;
          certifications: string[];
          skillLevels: string[];
          languages: string[];
          specializations: string[];
          specializationOffers: SpecializationOffer[];
          additionalServices: string[];
          offeredDurations: string[];
          achievements: string[];
          experienceYears: number | null;
          sportsExperienceYears: number | null;
          age: number | null;
          availabilitySlots: { day: number; from: string; to: string; busy?: boolean }[];
          hourlyRate: number;
          photoUrl: string;
          photoGallery: string[];
          ratingAvg: number;
          reviewCount: number;
        } | null;
      };
    },
    retry: false,
    refetchInterval: (query) => {
      const pollMs = devPollInterval(8000);
      if (!pollMs) return false;
      const snapshot = query.state.data;
      if (!snapshot) return pollMs;
      if (snapshot.verificationStatus === "PENDING" || snapshot.profilePendingReview) return pollMs;
      return false;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["instructor-stats"],
    queryFn: async () => {
      const r = await instructorFetch("/api/instructor/stats");
      if (!r.ok) throw new Error("stats");
      return r.json() as Promise<{
        orders: number;
        instructorShareTotal: number;
        grossTotal: number;
        availableForPayout?: number;
        pendingPayout?: number;
        canWithdraw?: boolean;
        payoutMinRub?: number;
        payoutWindowHint?: string;
      }>;
    },
  });

  const { data: orderAlerts } = useQuery({
    queryKey: ["instructor-order-alerts"],
    queryFn: async () => {
      const r = await fetch("/api/orders");
      if (!r.ok) throw new Error("orders-alerts");
      return r.json() as Promise<{
        orders: Array<{
          id: string;
          status: string;
          createdAt: string;
          pendingExpiresAt: string | null;
          flexibleInstructorInvite?: boolean;
          urgentInvite?: boolean;
          amountTotal: string | number | null;
          meetLat: number;
          meetLng: number;
          skillLevel: string;
          languagePref: string;
          duration: string;
          notes: string | null;
          requestedStartDate: string | null;
          requestedEndDate: string | null;
          requestedDays: number | null;
          resort: { name: string } | null;
          client: { name: string | null } | null;
        }>;
      }>;
    },
    refetchInterval: devPollInterval(5000),
  });

  const prevProfilePendingReviewRef = useRef<boolean | null>(null);
  const prevVerificationStatusRef = useRef<"PENDING" | "APPROVED" | "REJECTED" | null>(null);

  const activeOrderOptions = useMemo(() => {
    const active = new Set<OrderStatus>([
      "PENDING_INSTRUCTOR",
      "ACCEPTED",
      "INSTRUCTOR_EN_ROUTE",
      "LESSON_STARTED",
      "COMPLETED",
    ]);
    return (orderAlerts?.orders ?? [])
      .filter((o) => active.has(o.status as OrderStatus))
      .map((o) => ({
        id: o.id,
        label: `${o.client?.name ?? "Клиент"} · ${o.id.slice(-6)}`,
      }));
  }, [orderAlerts?.orders]);

  const { data: recentClientReviews } = useQuery({
    queryKey: ["instructor-client-reviews"],
    queryFn: async () => {
      const r = await fetch("/api/orders");
      if (!r.ok) throw new Error("orders-reviews");
      const j = (await r.json()) as {
        orders: Array<{
          id: string;
          status: string;
          updatedAt: string;
          clientRating: number | null;
          clientReview: string | null;
          instructorRating: number | null;
          instructorReview: string | null;
        }>;
      };
      return j.orders
        .filter((o) => o.status === "COMPLETED" && o.instructorRating != null)
        .slice(0, 5);
    },
  });

  const [online, setOnline] = useState<boolean | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [certificationLevel, setCertificationLevel] = useState("");
  const [certificationsRaw, setCertificationsRaw] = useState("");
  const [skillLevelsRaw, setSkillLevelsRaw] = useState("");
  const [languagesRaw, setLanguagesRaw] = useState("");
  const [specializationOffers, setSpecializationOffers] = useState<SpecializationOffer[]>([]);
  const [additionalServicesRaw, setAdditionalServicesRaw] = useState("");
  const [offeredDurationsRaw, setOfferedDurationsRaw] = useState("");
  const [achievementsRaw, setAchievementsRaw] = useState("");
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([
    { day: 1, from: "09:00", to: "12:00", busy: false },
  ]);
  const [age, setAge] = useState<number>(25);
  const [experienceYears, setExperienceYears] = useState<number>(5);
  const [sportsExperienceYears, setSportsExperienceYears] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoGallery, setPhotoGallery] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [dragPhotoUrl, setDragPhotoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [inited, setInited] = useState(false);
  /** Иначе Chrome подставляет «чужие» имя/фамилию из профиля браузера в поля с id вроде first-name. */
  const [publicNameFieldsUnlocked, setPublicNameFieldsUnlocked] = useState(false);

  useEffect(() => {
    if (searchParams.get("applied") === "1") {
      toast.success(
        "Заявка принята. Анкета на модерации — после одобрения администратором включите «онлайн» и принимайте заказы.",
        { duration: 12_000 },
      );
      router.replace("/instructor", { scroll: false });
    }
  }, [router, searchParams]);

  const effectiveOnline = online ?? data?.isOnline ?? false;

  useThrottledInstructorLocation(effectiveOnline);

  useEffect(() => {
    if (data?.profilePendingReview == null) return;
    const prev = prevProfilePendingReviewRef.current;
    prevProfilePendingReviewRef.current = data.profilePendingReview;
    if (prev === null) return;

    // Переход PENDING_REVIEW -> NONE после одобрения админом:
    // показываем подтверждение и не даём в этот момент всплыть модалке заказа.
    if (prev && !data.profilePendingReview) {
      window.dispatchEvent(new CustomEvent("skiinstruct:suppress-order-prompts"));
      toast.success("Модерация пройдена: изменения анкеты опубликованы");
      setInited(false);
      window.setTimeout(
        () => window.dispatchEvent(new CustomEvent("skiinstruct:unsuppress-order-prompts")),
        15_000,
      );
    }
  }, [data?.profilePendingReview, orderAlerts?.orders]);

  useEffect(() => {
    if (!data?.verificationStatus) return;
    const prev = prevVerificationStatusRef.current;
    prevVerificationStatusRef.current = data.verificationStatus;
    if (prev === null) return;
    if (prev === "PENDING" && data.verificationStatus === "APPROVED") {
      window.dispatchEvent(new CustomEvent("skiinstruct:suppress-order-prompts"));
      toast.success(
        "Анкета одобрена администратором. Заполните профиль и включите «онлайн», чтобы принимать заказы.",
        { duration: 12_000 },
      );
      setInited(false);
      void qc.invalidateQueries({ queryKey: ["io-online"] });
      window.setTimeout(
        () => window.dispatchEvent(new CustomEvent("skiinstruct:unsuppress-order-prompts")),
        15_000,
      );
    }
    if (prev === "PENDING" && data.verificationStatus === "REJECTED") {
      toast.error("Заявка инструктора отклонена. Смотрите комментарий администратора в анкете.");
      setInited(false);
    }
  }, [data?.verificationStatus, qc]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  const requestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (!window.isSecureContext) {
      toast.error("Уведомления работают только по HTTPS или на localhost");
      return;
    }
    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      const pushOk = await enableInstructorOfflineAlerts();
      toast.success(
        pushOk
          ? "Уведомления включены — заявки придут push и на почту, даже если сайт закрыт"
          : "Браузерные уведомления уже включены",
      );
      return;
    }
    if (Notification.permission === "denied") {
      setNotificationPermission("denied");
      toast.error("Уведомления заблокированы в браузере. Разрешите их в настройках сайта.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    if (perm === "granted") {
      const pushOk = await enableInstructorOfflineAlerts();
      toast.success(
        pushOk
          ? "Уведомления включены — заявки придут push и на почту, даже если сайт закрыт"
          : "Браузерные уведомления включены",
      );
      new Notification("SkiInstruct", {
        body: "Тест: уведомления работают.",
      });
    } else if (perm === "denied") {
      toast.error("Браузер заблокировал уведомления. Разрешите их в настройках сайта.");
    } else {
      toast.info("Запрос уведомлений закрыт без выбора.");
    }
  };

  useEffect(() => {
    if (inited || !data?.profile) return;
    setFirstName(data.profile.firstName ?? "");
    setLastName(data.profile.lastName ?? "");
    setBio(data.profile.bio ?? "");
    setCertificationLevel(data.profile.certificationLevel ?? "");
    setCertificationsRaw(data.profile.certifications.join(", "));
    setSkillLevelsRaw(data.profile.skillLevels.join(", "));
    setLanguagesRaw(data.profile.languages.join(", "));
    setSpecializationOffers(
      data.profile.specializationOffers?.length
        ? data.profile.specializationOffers
        : parseSpecializationOffers(
            null,
            data.profile.hourlyRate,
            data.profile.specializations,
          ),
    );
    setAdditionalServicesRaw(data.profile.additionalServices.join(", "));
    setOfferedDurationsRaw(data.profile.offeredDurations.join(", "));
    setAchievementsRaw(data.profile.achievements.join(", "));
    setAge(data.profile.age ?? 25);
    setExperienceYears(data.profile.experienceYears ?? 5);
    setSportsExperienceYears(data.profile.sportsExperienceYears ?? 0);
    setAvailabilitySlots(
      data.profile.availabilitySlots?.length
        ? data.profile.availabilitySlots
        : [{ day: 1, from: "09:00", to: "12:00", busy: false }]
    );
    setPhotoUrl(data.profile.photoUrl ?? "");
    setPhotoGallery(data.profile.photoGallery ?? []);
    setPublicNameFieldsUnlocked(false);
    setInited(true);
  }, [data?.profile, inited]);

  const pushLocationOnce = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void instructorFetch("/api/instructor/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });
      },
      () => {
        /* denied — подсказка уже на экране */
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  };

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) pushLocationOnce();
      const r = await instructorFetch("/api/instructor/online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: next }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) {
        const msg =
          typeof j.error === "string"
            ? j.error
            : "Не удалось обновить статус";
        throw new Error(msg);
      }
      return next;
    },
    onSuccess: (next) => {
      setOnline(next);
      void qc.invalidateQueries({ queryKey: ["io-online"] });
      toast.success(
        next
          ? "Вы на линии — клиенты увидят вас на карте в радиусе"
          : "Офлайн",
      );
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось обновить статус"),
  });

  function validateProfileForm(): { ok: boolean; availabilitySlots: AvailabilitySlot[] } {
    const errors: Partial<Record<ProfileField, string>> = {};

    if (!certificationLevel.trim()) errors.certificationLevel = "Укажите уровень сертификации";
    if (!languagesRaw.trim()) errors.languagesRaw = "Укажите хотя бы один язык";
    if (!specializationOffers.length) {
      errors.specializationOffers = "Добавьте хотя бы одно направление с ценой";
    } else if (specializationOffers.some((o) => o.hourlyRate < 500)) {
      errors.specializationOffers = "Минимум 500 ₽/ч для каждого направления";
    } else {
      for (const o of specializationOffers) {
        if (!isAutoInstructorLabel(o.label)) continue;
        const drivingErr = validateDrivingSchoolDetails(o.drivingDetails);
        if (drivingErr) {
          errors.specializationOffers = drivingErr;
          break;
        }
      }
    }
    if (age > 0 && (age < 14 || age > 90)) errors.age = "Возраст должен быть от 14 до 90";

    const normalizedSlots = normalizeAvailabilitySlots(availabilitySlots);
    const availabilityErr = validateAvailabilitySlots(normalizedSlots);
    if (availabilityErr) {
      errors.availabilityRaw = availabilityErr;
    }

    setFieldErrors(errors);
    return { ok: Object.keys(errors).length === 0, availabilitySlots: normalizedSlots };
  }

  const addSlotForDay = (day: number) => {
    setAvailabilitySlots((prev) => [...prev, { day, from: "09:00", to: "12:00", busy: false }]);
  };

  const updateSlot = (index: number, patch: Partial<AvailabilitySlot>) => {
    setAvailabilitySlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot))
    );
  };

  const removeSlot = (index: number) => {
    setAvailabilitySlots((prev) => prev.filter((_, i) => i !== index));
  };

  const fillWeekdays = () => {
    setAvailabilitySlots([
      { day: 1, from: "09:00", to: "18:00", busy: false },
      { day: 2, from: "09:00", to: "18:00", busy: false },
      { day: 3, from: "09:00", to: "18:00", busy: false },
      { day: 4, from: "09:00", to: "18:00", busy: false },
      { day: 5, from: "09:00", to: "18:00", busy: false },
    ]);
  };

  const saveProfile = useMutation({
    onMutate: () => {
      window.dispatchEvent(new CustomEvent("skiinstruct:suppress-order-prompts"));
    },
    mutationFn: async () => {
      const validation = validateProfileForm();
      if (!validation.ok) {
        throw new Error("Проверьте поля, выделенные красным");
      }

      const languages = languagesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const certifications = certificationsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const skillLevels = skillLevelsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const additionalServices = additionalServicesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const offeredDurations = offeredDurationsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const achievements = achievementsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const availabilitySlots = validation.availabilitySlots;

      const r = await instructorFetch("/api/instructor/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          bio,
          certificationLevel,
          certifications,
          skillLevels,
          languages,
          specializationOffers,
          additionalServices,
          offeredDurations,
          achievements,
          age: age >= 14 ? age : undefined,
          experienceYears,
          sportsExperienceYears,
          availabilitySlots,
          photoUrl,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: unknown;
        profilePendingReview?: boolean;
        verificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
      };
      if (!r.ok) {
        const msg =
          typeof j.error === "string"
            ? j.error
            : "Не удалось сохранить профиль (подробности в логах сервера)";
        if (r.status === 401) {
          router.push("/instructor/login");
        }
        throw new Error(msg);
      }
      return j;
    },
    onSuccess: async (result) => {
      setFieldErrors({});
      toast.success(
        result.verificationStatus === "APPROVED"
          ? "Изменения отправлены на проверку администратором"
          : "Анкета сохранена. Ожидайте одобрения администратором",
      );
      await qc.invalidateQueries({ queryKey: ["io-online"] });
      await qc.refetchQueries({ queryKey: ["io-online"] });
      setInited(false);
      await qc.invalidateQueries({ queryKey: ["nearby"], exact: false });
    },
    onError: (e: Error) =>
      toast.error(e.message || "Не удалось сохранить профиль"),
    onSettled: () => {
      window.setTimeout(
        () => window.dispatchEvent(new CustomEvent("skiinstruct:unsuppress-order-prompts")),
        10_000,
      );
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: async () => {
      if (!photoFile) throw new Error("file");
      const toUpload = await compressImageFile(photoFile);
      const fd = new FormData();
      fd.append("file", toUpload);
      const r = await instructorFetch("/api/instructor/photo", {
        method: "POST",
        body: fd,
      });
      const j = (await r.json().catch(() => ({}))) as {
        photoUrl?: string;
        photoGallery?: string[];
        profilePendingReview?: boolean;
        error?: unknown;
      };
      if (!r.ok || !j.photoUrl) {
        throw new Error(typeof j.error === "string" ? j.error : "upload");
      }
      return j;
    },
    onSuccess: async (payload) => {
      setPhotoUrl(payload.photoUrl ?? "");
      setPhotoGallery(payload.photoGallery ?? []);
      setPhotoFile(null);
      toast.success(
        payload.profilePendingReview
          ? "Фото в черновике — ждёт одобрения администратором"
          : "Фото загружено",
      );
      await qc.invalidateQueries({ queryKey: ["io-online"] });
      await qc.refetchQueries({ queryKey: ["io-online"] });
      setInited(false);
      await qc.invalidateQueries({ queryKey: ["nearby"], exact: false });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePhoto = useMutation({
    mutationFn: async (urlToRemove?: string) => {
      const r = await instructorFetch(
        urlToRemove
          ? `/api/instructor/photo?photoUrl=${encodeURIComponent(urlToRemove)}`
          : "/api/instructor/photo",
        { method: "DELETE" },
      );
      const j = (await r.json().catch(() => ({}))) as {
        photoUrl?: string | null;
        photoGallery?: string[];
      };
      if (!r.ok) throw new Error("remove");
      return j;
    },
    onSuccess: async (payload) => {
      setPhotoUrl(payload.photoUrl ?? "");
      setPhotoGallery(payload.photoGallery ?? []);
      setPhotoFile(null);
      toast.success("Фото удалено");
      await qc.invalidateQueries({ queryKey: ["io-online"] });
      await qc.refetchQueries({ queryKey: ["io-online"] });
      setInited(false);
      await qc.invalidateQueries({ queryKey: ["nearby"], exact: false });
    },
    onError: () => toast.error("Не удалось удалить фото"),
  });

  const updatePhotoGallery = useMutation({
    mutationFn: async (payload: { photoGallery?: string[]; coverUrl?: string }) => {
      const r = await instructorFetch("/api/instructor/photo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json().catch(() => ({}))) as {
        photoUrl?: string | null;
        photoGallery?: string[];
      };
      if (!r.ok) throw new Error("update-gallery");
      return j;
    },
    onSuccess: async (payload) => {
      setPhotoUrl(payload.photoUrl ?? "");
      setPhotoGallery(payload.photoGallery ?? []);
      await qc.invalidateQueries({ queryKey: ["io-online"] });
      await qc.refetchQueries({ queryKey: ["io-online"] });
      setInited(false);
      await qc.invalidateQueries({ queryKey: ["nearby"], exact: false });
    },
    onError: () => toast.error("Не удалось обновить порядок/обложку"),
  });

  return (
    <div className="space-y-6">
      {signedInAsOtherRole ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">
            В этом браузере активна сессия{" "}
            {session?.user?.role === "ADMIN" ? "администратора" : "клиента"}, а не инструктора.
          </p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Если вы одобряли анкету из админки в той же вкладке или браузере, сессия инструктора была
            заменена. Чтобы снова редактировать анкету, войдите как инструктор (отдельное окно или режим
            инкогнито для админки удобнее при проверке).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/instructor/login?callbackUrl=%2Finstructor">Войти как инструктор</Link>
            </Button>
            {session?.user?.role === "ADMIN" ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/admin/activity">Админ-панель</Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/client">Кабинет клиента</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Кабинет инструктора</h1>
          <p className="text-sm text-muted-foreground">
            Координаты обновляются с геолокации не чаще 1 раза в 30 секунд.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notificationPermission !== "unsupported" ? (
            <Button
              type="button"
              variant={notificationPermission === "granted" ? "accent" : "outline"}
              className={cn(
                notificationPermission === "granted"
                  ? "shadow-[0_0_0_2px] shadow-orange-500/35"
                  : "focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
              onClick={requestNotifications}
            >
              {notificationPermission === "granted" ? "Уведомления включены" : "Включить уведомления"}
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/instructor/orders">Мои заказы</Link>
          </Button>
        </div>
      </div>

      <nav
        aria-label="Разделы кабинета"
        className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/30 p-3"
      >
        {INSTRUCTOR_PANEL_SECTIONS.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => scrollToInstructorSection(id)}
          >
            {label}
          </Button>
        ))}
      </nav>

      <InstructorWeekScheduleCalendar
        availabilitySlots={availabilitySlots}
        availabilityError={fieldErrors.availabilityRaw}
        onAvailabilityChange={setAvailabilitySlots}
        onAddSlotForDay={addSlotForDay}
        onUpdateSlot={updateSlot}
        onRemoveSlot={removeSlot}
        onFillWeekdays={fillWeekdays}
        onClearSlots={() => setAvailabilitySlots([])}
        effectiveOnline={effectiveOnline}
        toggleOnlinePending={toggle.isPending}
        onToggleOnline={() => toggle.mutate(!effectiveOnline)}
        verificationStatus={data?.verificationStatus}
        loadingOnlineState={isLoading && data == null && online == null}
      />

      <Card id="profile" className="scroll-mt-24 bg-gradient-to-br from-sky-50/70 to-background dark:from-slate-900">
        <CardHeader>
          <CardTitle>Профиль инструктора (для клиентов)</CardTitle>
          <CardDescription>
            Заполните навыки и описание — это показывается в раскрытом профиле в меню заказа.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.verificationStatus === "PENDING" ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Анкета на первичной проверке администратором. После одобрения вы появитесь в поиске у клиентов.
            </p>
          ) : null}
          {data?.profilePendingReview ? (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
              Изменения отправлены на модерацию. Клиенты пока видят прежнюю версию анкеты.
            </p>
          ) : null}
          {data?.profileDraftRejectNote && !data.profilePendingReview ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-red-200">
              <p className="font-medium">Изменения отклонены администратором</p>
              {data.profileDraftRejectedAt ? (
                <p className="mt-0.5 text-xs opacity-80">
                  {new Date(data.profileDraftRejectedAt).toLocaleString("ru-RU")}
                </p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap">{data.profileDraftRejectNote}</p>
              <p className="mt-2 text-xs opacity-90">
                Исправьте анкету и сохраните снова — комментарий исчезнет после повторной отправки на модерацию.
              </p>
            </div>
          ) : null}
          {!data?.profile ? (
            <p className="text-sm text-muted-foreground">Профиль ещё не создан.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="instr-public-fn">Имя</Label>
                  <Input
                    id="instr-public-fn"
                    name="skiinstruct_instructor_public_fn"
                    autoComplete="off"
                    inputMode="text"
                    spellCheck={false}
                    readOnly={inited && !publicNameFieldsUnlocked}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onFocus={() => setPublicNameFieldsUnlocked(true)}
                    placeholder="Иван"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instr-public-ln">Фамилия</Label>
                  <Input
                    id="instr-public-ln"
                    name="skiinstruct_instructor_public_ln"
                    autoComplete="off"
                    inputMode="text"
                    spellCheck={false}
                    readOnly={inited && !publicNameFieldsUnlocked}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onFocus={() => setPublicNameFieldsUnlocked(true)}
                    placeholder="Иванов"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cert">Сертификация</Label>
                  <Input
                    id="cert"
                    list="certification-level-options"
                    value={certificationLevel}
                    onChange={(e) => setCertificationLevel(e.target.value)}
                    placeholder="ISIA Level 3 / CASI / Austrian ..."
                    className={cn(fieldErrors.certificationLevel && "border-destructive ring-destructive")}
                  />
                  {fieldErrors.certificationLevel ? (
                    <p className="text-xs text-destructive">{fieldErrors.certificationLevel}</p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="age">Возраст</Label>
                  <Input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value) || 0)}
                    className={cn(fieldErrors.age && "border-destructive ring-destructive")}
                  />
                  {fieldErrors.age ? (
                    <p className="text-xs text-destructive">{fieldErrors.age}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp">Стаж инструктора (лет)</Label>
                  <Input
                    id="exp"
                    type="number"
                    min={0}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sports-exp">Стаж в спорте (лет)</Label>
                  <Input
                    id="sports-exp"
                    type="number"
                    min={0}
                    value={sportsExperienceYears}
                    onChange={(e) => setSportsExperienceYears(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <MultiSelectChipsField
                id="certs"
                label="Ключевые сертификаты"
                value={certificationsRaw}
                onChange={setCertificationsRaw}
                options={CERTIFICATION_LEVEL_OPTIONS}
                placeholder="ISIA, CASI, Austrian Ski Instructor"
              />
              <MultiSelectChipsField
                id="levels"
                label="Уровни подготовки"
                value={skillLevelsRaw}
                onChange={setSkillLevelsRaw}
                options={SKILL_LEVEL_OPTIONS}
                placeholder="Для начинающих, Средний, Продвинутый, Эксперт"
              />

              <MultiSelectChipsField
                id="langs"
                label="Языки"
                value={languagesRaw}
                onChange={setLanguagesRaw}
                options={LANGUAGE_OPTIONS}
                placeholder="Русский, English, Deutsch"
                error={fieldErrors.languagesRaw}
              />

              <SpecializationOffersEditor
                offers={specializationOffers}
                onChange={(next) => {
                  setSpecializationOffers(next);
                  setBio((b) =>
                    syncSeedLikeBioFromSpecsCsv(b, next.map((o) => o.label).join(", ")),
                  );
                }}
                error={fieldErrors.specializationOffers}
              />
              <MultiSelectChipsField
                id="services"
                label="Дополнительные услуги"
                value={additionalServicesRaw}
                onChange={setAdditionalServicesRaw}
                options={SERVICE_OPTIONS}
                placeholder="Аренда, Трансфер, Видеоразбор, Фотосъёмка"
              />
              <MultiSelectChipsField
                id="durations"
                label="Длительности занятия"
                value={offeredDurationsRaw}
                onChange={setOfferedDurationsRaw}
                options={DURATION_OPTIONS}
                placeholder="1 ч, 1.5 ч, 2 ч, Полдня, День"
              />
              <div className="space-y-2">
                <Label htmlFor="achv">Лучшие достижения (через запятую)</Label>
                <Input id="achv" value={achievementsRaw} onChange={(e) => setAchievementsRaw(e.target.value)} placeholder="Победы в соревнованиях, подготовка спортсменов..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo-upload">Фото профиля</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="photo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!photoFile || uploadPhoto.isPending || photoGallery.length >= 5}
                    onClick={() => uploadPhoto.mutate()}
                  >
                    Загрузить фото (сжатие)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!photoGallery.length || removePhoto.isPending}
                    onClick={() => removePhoto.mutate(undefined)}
                  >
                    Удалить все фото
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Загружено: {photoGallery.length}/5
                </p>
                <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-2">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-border bg-background">
                    {photoUrl || photoGallery[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl || photoGallery[0]}
                        alt="Фото профиля"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        Фото
                      </div>
                    )}
                  </div>
                  <div className="text-xs">
                    <div className="font-medium">
                      {[firstName, lastName].filter(Boolean).join(" ") || "Имя и фамилия не заполнены"}
                    </div>
                    <div className="text-muted-foreground">Возраст: {age || "—"}</div>
                  </div>
                </div>
                {photoGallery.length ? (
                  <div className="grid grid-cols-5 gap-2">
                    {photoGallery.map((p) => (
                      <div
                        key={p}
                        className={`relative ${photoUrl === p ? "ring-2 ring-accent" : ""}`}
                        draggable
                        onDragStart={() => setDragPhotoUrl(p)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!dragPhotoUrl || dragPhotoUrl === p) return;
                          const next = [...photoGallery];
                          const from = next.indexOf(dragPhotoUrl);
                          const to = next.indexOf(p);
                          if (from < 0 || to < 0) return;
                          next.splice(from, 1);
                          next.splice(to, 0, dragPhotoUrl);
                          setPhotoGallery(next);
                          void updatePhotoGallery.mutate({ photoGallery: next });
                          setDragPhotoUrl(null);
                        }}
                      >
                        <button
                          type="button"
                          className="h-20 w-20 overflow-hidden rounded-md border border-border"
                          onClick={() => setPreviewUrl(p)}
                          aria-label="Открыть фото"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p} alt="Фото инструктора" className="h-full w-full object-cover" />
                        </button>
                        <button
                          type="button"
                          className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                          onClick={() => void updatePhotoGallery.mutate({ coverUrl: p })}
                        >
                          {photoUrl === p ? "Обложка" : "Сделать обложкой"}
                        </button>
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-white"
                          onClick={() => removePhoto.mutate(p)}
                          aria-label="Удалить фото"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {photoGallery.length > 1 ? (
                  <p className="text-xs text-muted-foreground">
                    Перетаскивайте фото для изменения порядка. Фото с рамкой — обложка профиля.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Биография и достижения</Label>
                <textarea
                  id="bio"
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="ISIA Level 3, стаж 12 лет, работал в Швейцарии..."
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <div className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>
                    {data.profile.ratingAvg.toFixed(1)} ({data.profile.reviewCount} отзывов)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="accent"
                  disabled={saveProfile.isPending || signedInAsOtherRole}
                  onClick={() => saveProfile.mutate()}
                >
                  Сохранить профиль
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div id="events" className="scroll-mt-24">
        <InstructorEventsEditor activeOrders={activeOrderOptions} />
      </div>

      <div id="compliance" className="scroll-mt-24">
        <InstructorComplianceCard />
      </div>

      <Card id="finance" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Финансы (выплаченные заказы)</CardTitle>
          <CardDescription>Доля инструктора после комиссии платформы (15%).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Завершённых оплаченных: {stats?.orders ?? "…"}</div>
          <div>Ваша доля (всего): {stats ? `${stats.instructorShareTotal.toFixed(0)} ₽` : "…"}</div>
          <div>
            Доступно к выплате:{" "}
            {stats ? `${stats.availableForPayout?.toFixed(0) ?? "…"} ₽` : "…"}
          </div>
          <div className="text-muted-foreground">
            В ожидании срока:{" "}
            {stats ? `${stats.pendingPayout?.toFixed(0) ?? "…"} ₽` : "…"}
          </div>
          <div className="text-muted-foreground">
            Оборот: {stats ? `${stats.grossTotal.toFixed(0)} ₽` : "…"}
          </div>
          {stats?.payoutWindowHint ? (
            <p className="text-xs text-muted-foreground">{stats.payoutWindowHint}</p>
          ) : null}
          <InstructorPayoutPanel
            canWithdraw={stats?.canWithdraw}
            payoutMinRub={stats?.payoutMinRub}
            availableForPayout={stats?.availableForPayout}
          />
        </CardContent>
      </Card>

      <Card id="reviews" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Ваши отзывы о клиентах</CardTitle>
          <CardDescription>Показываются в анкете клиента после завершения заказа.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!recentClientReviews?.length ? (
            <p className="text-muted-foreground">Пока отзывов нет.</p>
          ) : (
            recentClientReviews.map((r) => (
              <div key={r.id} className="rounded-md border border-border bg-muted/30 p-2">
                <div className="font-medium">Оценка: {r.instructorRating}/5</div>
                <div className="text-muted-foreground">{r.instructorReview || "Без текста"}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фото"
        >
          <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Просмотр фото инструктора"
              className="max-h-[90vh] max-w-[90vw] rounded-lg border border-white/20 object-contain"
            />
          </div>
        </div>
      ) : null}

      <datalist id="certification-level-options">
        {CERTIFICATION_LEVEL_OPTIONS.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <datalist id="skill-level-options">
        {SKILL_LEVEL_OPTIONS.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <datalist id="language-options">
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <datalist id="specialization-options">
        {INSTRUCTOR_ACTIVITY_LABELS.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <datalist id="service-options">
        {SERVICE_OPTIONS.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <datalist id="duration-options">
        {DURATION_OPTIONS.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>

    </div>
  );
}
