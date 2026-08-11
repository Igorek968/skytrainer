"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Star, X } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

import { useThrottledInstructorLocation } from "@/features/geolocation/use-throttled-instructor-location";
import { devPollInterval } from "@/lib/query-poll";
import { InstructorComplianceCard } from "@/features/instructor/instructor-compliance-card";
import { InstructorPayoutPanel } from "@/features/instructor/instructor-payout-panel";
import { ReferralProgramPanel } from "@/features/referral/referral-program-panel";
import { InstructorEventCatalogSection } from "@/features/instructor/instructor-event-catalog-section";
import { enableInstructorOfflineAlerts } from "@/features/instructor/instructor-panel-shell";
import { fireSiteAlert, siteAlertTitle } from "@/lib/site-alert";
import {
  getWebPushUiMode,
  isIosDevice,
  isIosHomeScreenPwa,
} from "@/features/push/web-push-client";
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
  filledSpecializationOffers,
  ensureSpecializationOfferRows,
} from "@/lib/instructor-specialization-offers";
import { activityLabelSortKey } from "@/lib/services/instructor-match";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { PhotoViewerOverlay, type PhotoViewerState } from "@/shared/ui/photo-viewer-overlay";
import { cn } from "@/lib/utils";
import { instructorActivityLabelsAlphabetical } from "@/lib/services/instructor-match";
import { INSTRUCTOR_NO_SHOW_PENALTY_PERCENT } from "@/lib/legal-config";
import { useDisplayNameDuplicateCheck } from "@/shared/hooks/use-display-name-duplicate-check";
import { compressImageFile } from "@/lib/compress-image-client";

const instructorFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, credentials: "include" });

const CATEGORY_OPTIONS = ["A", "B", "C", "D"];
const SKILL_LEVEL_OPTIONS = ["Для начинающих", "Средний", "Продвинутый", "Эксперт"];
const LANGUAGE_OPTIONS = ["Русский", "English", "Deutsch", "Français", "Italiano"];
const SERVICE_OPTIONS = [
  "Аренда инвентаря",
  "Трансфер к месту встречи",
  "Видеоразбор техники",
  "Фотосъёмка на склоне",
];
const DURATION_OPTIONS = ["1 ч", "1.5 ч", "2 ч", "Полдня", "День"];

/** Non-negative int for profile year fields — no leading zeros, empty when cleared. */
type NonNegIntInput = number | "";

function parseNonNegIntInput(raw: string): NonNegIntInput {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.replace(/^0+(?=\d)/, "");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return "";
  return Math.floor(n);
}

function nonNegIntOrEmpty(value: number | null | undefined): NonNegIntInput {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : "";
}
const INSTRUCTOR_PANEL_SECTIONS = [
  { id: "lesson-schedule", label: "Календарь" },
  { id: "profile", label: "Профиль инструктора" },
  { id: "events", label: "Мероприятия" },
  { id: "compliance", label: "Соответствие и выплаты" },
  { id: "referral", label: "Рефералы" },
  { id: "finance", label: "Финансы" },
  { id: "reviews", label: "Отзывы о клиентах" },
] as const;

type PanelSectionId = (typeof INSTRUCTOR_PANEL_SECTIONS)[number]["id"];

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
        platformPenaltyBalanceRub?: number;
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
  const [skillLevelsRaw, setSkillLevelsRaw] = useState("");
  const [languagesRaw, setLanguagesRaw] = useState("");
  const [specializationOffers, setSpecializationOffers] = useState<SpecializationOffer[]>([]);
  const [additionalServicesRaw, setAdditionalServicesRaw] = useState("");
  const [offeredDurationsRaw, setOfferedDurationsRaw] = useState("");
  const [achievementsRaw, setAchievementsRaw] = useState("");
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([
    { day: 1, from: "09:00", to: "12:00", busy: false },
  ]);
  const [age, setAge] = useState<NonNegIntInput>(25);
  const [experienceYears, setExperienceYears] = useState<NonNegIntInput>(5);
  const [sportsExperienceYears, setSportsExperienceYears] = useState<NonNegIntInput>("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoGallery, setPhotoGallery] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [dragPhotoUrl, setDragPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<PhotoViewerState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [inited, setInited] = useState(false);
  /** Иначе Chrome подставляет «чужие» имя/фамилию из профиля браузера в поля с id вроде first-name. */
  const [publicNameFieldsUnlocked, setPublicNameFieldsUnlocked] = useState(false);
  const [activePanelSection, setActivePanelSection] = useState<PanelSectionId>("lesson-schedule");
  const displayNameDuplicate = useDisplayNameDuplicateCheck(firstName, lastName, inited);

  const navigatePanelSection = useCallback((sectionId: PanelSectionId) => {
    setActivePanelSection(sectionId);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/instructor#${sectionId}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    const known = INSTRUCTOR_PANEL_SECTIONS.find((s) => s.id === hash);
    if (known) setActivePanelSection(known.id);
  }, []);

  useEffect(() => {
    if (searchParams.get("applied") === "1") {
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
    if (typeof window === "undefined") return;
    const mode = getWebPushUiMode();
    if (mode === "needs-ios-homescreen") {
      setNotificationPermission("default");
      return;
    }
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  const requestNotifications = async () => {
    if (typeof window === "undefined") return;
    // iOS: API уведомлений есть только у PWA с экрана «Домой» (не у вкладки Safari).
    if (isIosDevice() && !isIosHomeScreenPwa()) {
      toast.message("Сначала добавьте приложение на экран «Домой»", {
        description: "Safari → Поделиться → На экран «Домой», затем откройте ярлык и включите уведомления.",
      });
      return;
    }
    if (!("Notification" in window)) {
      toast.error(
        "Уведомления недоступны. Нужен iOS 16.4+, Safari и открытие с ярлыка на экране «Домой» (не из вкладки Safari).",
      );
      return;
    }
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
      fireSiteAlert({
        title: siteAlertTitle("уведомления включены"),
        body: "Тест: звук, вибрация и оповещения работают.",
        sound: "chat",
        tag: "instructor-notifications-test",
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
    setSkillLevelsRaw(data.profile.skillLevels.join(", "));
    setLanguagesRaw(data.profile.languages.join(", "));
    setSpecializationOffers(
      ensureSpecializationOfferRows(
        data.profile.specializationOffers?.length
          ? data.profile.specializationOffers
          : parseSpecializationOffers(
              null,
              data.profile.hourlyRate,
              data.profile.specializations,
            ),
        data.profile.hourlyRate,
      ),
    );
    setAdditionalServicesRaw(data.profile.additionalServices.join(", "));
    setOfferedDurationsRaw(data.profile.offeredDurations.join(", "));
    setAchievementsRaw(data.profile.achievements.join(", "));
    setAge(typeof data.profile.age === "number" && data.profile.age > 0 ? data.profile.age : 25);
    setExperienceYears(
      typeof data.profile.experienceYears === "number" && data.profile.experienceYears > 0
        ? data.profile.experienceYears
        : data.profile.experienceYears == null
          ? 5
          : "",
    );
    setSportsExperienceYears(nonNegIntOrEmpty(data.profile.sportsExperienceYears));
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

    if (displayNameDuplicate.duplicate) {
      toast.error(displayNameDuplicate.message ?? "Укажите другие имя или фамилию");
      return { ok: false, availabilitySlots: normalizeAvailabilitySlots(availabilitySlots) };
    }

    if (!certificationLevel.trim()) errors.certificationLevel = "Укажите категорию";
    if (!languagesRaw.trim()) errors.languagesRaw = "Укажите хотя бы один язык";
    const filledOffers = filledSpecializationOffers(specializationOffers);
    if (!filledOffers.length) {
      errors.specializationOffers = "Укажите хотя бы одно направление и цену";
    } else if (filledOffers.some((o) => o.hourlyRate < 500)) {
      errors.specializationOffers = "Минимум 500 ₽/ч для каждого направления";
    } else if (
      new Set(filledOffers.map((o) => activityLabelSortKey(o.label))).size !== filledOffers.length
    ) {
      errors.specializationOffers = "Направления не должны повторяться";
    } else {
      for (const o of filledOffers) {
        if (!isAutoInstructorLabel(o.label)) continue;
        const drivingErr = validateDrivingSchoolDetails(o.drivingDetails);
        if (drivingErr) {
          errors.specializationOffers = drivingErr;
          break;
        }
      }
    }
    if (typeof age === "number" && age > 0 && (age < 14 || age > 90)) {
      errors.age = "Возраст должен быть от 14 до 90";
    }

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
      const certLevel = certificationLevel.trim();
      const certifications = certLevel ? [certLevel] : [];
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

      const offersToSave = filledSpecializationOffers(specializationOffers);

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
          specializationOffers: offersToSave,
          additionalServices,
          offeredDurations,
          achievements,
          age: typeof age === "number" && age >= 14 ? age : undefined,
          experienceYears: experienceYears === "" ? null : experienceYears,
          sportsExperienceYears: sportsExperienceYears === "" ? null : sportsExperienceYears,
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
    mutationFn: async (file: File) => {
      const toUpload = await compressImageFile(file);
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
      if (photoInputRef.current) photoInputRef.current.value = "";
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
    onError: (e: Error) => {
      if (photoInputRef.current) photoInputRef.current.value = "";
      toast.error(e.message);
    },
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
      if (photoInputRef.current) photoInputRef.current.value = "";
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
                <Link href="/admin/metrics">Админ-панель</Link>
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
          {notificationPermission !== "unsupported" || isIosDevice() ? (
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
              {notificationPermission === "granted"
                ? "Уведомления включены"
                : isIosDevice() && getWebPushUiMode() === "needs-ios-homescreen"
                  ? "Как включить на iPhone"
                  : "Включить уведомления"}
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
            variant={activePanelSection === id ? "accent" : "outline"}
            size="sm"
            onClick={() => navigatePanelSection(id)}
          >
            {label}
          </Button>
        ))}
      </nav>

      {activePanelSection === "lesson-schedule" ? (
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
      ) : null}

      {activePanelSection === "profile" ? (
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
                {displayNameDuplicate.duplicate ? (
                  <p className="md:col-span-2 text-xs text-destructive">{displayNameDuplicate.message}</p>
                ) : displayNameDuplicate.checking && firstName.trim() && lastName.trim() ? (
                  <p className="md:col-span-2 text-xs text-muted-foreground">Проверка имени…</p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="cert">Категория</Label>
                  <select
                    id="cert"
                    value={certificationLevel}
                    onChange={(e) => setCertificationLevel(e.target.value)}
                    className={cn(
                      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      fieldErrors.certificationLevel && "border-destructive ring-destructive",
                    )}
                  >
                    <option value="">Выберите категорию</option>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    {certificationLevel &&
                    !CATEGORY_OPTIONS.includes(certificationLevel) ? (
                      <option value={certificationLevel}>{certificationLevel}</option>
                    ) : null}
                  </select>
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={age}
                    onChange={(e) => setAge(parseNonNegIntInput(e.target.value))}
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(parseNonNegIntInput(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sports-exp">Стаж в спорте (лет)</Label>
                  <Input
                    id="sports-exp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={sportsExperienceYears}
                    onChange={(e) => setSportsExperienceYears(parseNonNegIntInput(e.target.value))}
                  />
                </div>
              </div>
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
                    ref={photoInputRef}
                    id="photo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploadPhoto.isPending || photoGallery.length >= 5}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (photoGallery.length >= 5) {
                        toast.error("Максимум 5 фото");
                        e.target.value = "";
                        return;
                      }
                      uploadPhoto.mutate(file);
                    }}
                  />
                  {uploadPhoto.isPending ? (
                    <span className="text-sm text-muted-foreground">Загрузка…</span>
                  ) : null}
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
                    {photoGallery.map((p, photoIndex) => (
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
                          onClick={() => setPhotoPreview({ urls: photoGallery, index: photoIndex })}
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
                  disabled={
                    saveProfile.isPending || signedInAsOtherRole || displayNameDuplicate.duplicate
                  }
                  onClick={() => saveProfile.mutate()}
                >
                  Сохранить профиль
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      ) : null}

      {activePanelSection === "events" ? (
        <div id="events" className="scroll-mt-24 space-y-0">
          <InstructorEventCatalogSection activeOrders={activeOrderOptions} />
        </div>
      ) : null}

      {activePanelSection === "compliance" ? (
      <div id="compliance" className="scroll-mt-24">
        <InstructorComplianceCard />
      </div>
      ) : null}

      {activePanelSection === "referral" ? (
      <Card id="referral" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Реферальная программа</CardTitle>
          <CardDescription>
            250 ₽ за каждый из первых 4 завершённых оплаченных заказов приглашённого клиента.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReferralProgramPanel />
        </CardContent>
      </Card>
      ) : null}

      {activePanelSection === "finance" ? (
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
          {stats && (stats.platformPenaltyBalanceRub ?? 0) > 0 ? (
            <div className="text-destructive">
              Штрафы к удержанию: {stats.platformPenaltyBalanceRub!.toFixed(0)} ₽ (
              {INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}% при неявке)
            </div>
          ) : null}
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
      ) : null}

      {activePanelSection === "reviews" ? (
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
      ) : null}

      {photoPreview ? (
        <PhotoViewerOverlay
          urls={photoPreview.urls}
          index={photoPreview.index}
          onIndexChange={(index) => setPhotoPreview((prev) => (prev ? { ...prev, index } : prev))}
          onClose={() => setPhotoPreview(null)}
          ariaLabel="Просмотр фото"
        />
      ) : null}

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
        {instructorActivityLabelsAlphabetical().map((opt) => (
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
