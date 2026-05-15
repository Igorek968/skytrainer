"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Plus, Star, Trash2, X } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

import { useThrottledInstructorLocation } from "@/features/geolocation/use-throttled-instructor-location";
import { useInstructorPendingOrderAlerts } from "@/features/instructor/use-instructor-pending-order-alerts";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";
import { INSTRUCTOR_ACTIVITY_LABELS } from "@/lib/services/instructor-match";
import { orderRelaxedInstructorTiming } from "@/shared/lib/order-flex";
import { hasLessonTimeWindowInNotes, lessonTimeWindowLineFromNotes } from "@/shared/lib/order-lesson-times";
import { orderStatusLabel } from "@/shared/lib/order-status";

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
const FULL_DAY_LABELS = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

type AvailabilitySlot = { day: number; from: string; to: string; busy?: boolean };

type ProfileField =
  | "certificationLevel"
  | "languagesRaw"
  | "specializationsRaw"
  | "hourlyRate"
  | "age"
  | "availabilityRaw"
  | "telegramUrl"
  | "whatsappUrl"
  | "instagramUrl"
  | "videoVisitUrl";

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
  const qc = useQueryClient();
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  const { data, isLoading } = useQuery({
    queryKey: ["io-online"],
    queryFn: async () => {
      const r = await fetch("/api/instructor/me");
      if (!r.ok) throw new Error("me");
      return r.json() as Promise<{
        isOnline: boolean;
        profile: {
          firstName: string;
          lastName: string;
          bio: string;
          certificationLevel: string;
          certifications: string[];
          skillLevels: string[];
          languages: string[];
          specializations: string[];
          additionalServices: string[];
          offeredDurations: string[];
          achievements: string[];
          experienceYears: number | null;
          totalLessons: number | null;
          age: number | null;
          availabilitySlots: { day: number; from: string; to: string; busy?: boolean }[];
          cancellationPolicy: string;
          supportContact: string;
          legalInfo: string;
          telegramUrl: string;
          whatsappUrl: string;
          instagramUrl: string;
          videoVisitUrl: string;
          hourlyRate: number;
          photoUrl: string;
          photoGallery: string[];
          ratingAvg: number;
          reviewCount: number;
        } | null;
      }>;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["instructor-stats"],
    queryFn: async () => {
      const r = await fetch("/api/instructor/stats");
      if (!r.ok) throw new Error("stats");
      return r.json() as Promise<{
        orders: number;
        instructorShareTotal: number;
        grossTotal: number;
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
    refetchInterval: 5000,
  });

  useInstructorPendingOrderAlerts(orderAlerts?.orders);

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
  const [specializationsRaw, setSpecializationsRaw] = useState("");
  const [additionalServicesRaw, setAdditionalServicesRaw] = useState("");
  const [offeredDurationsRaw, setOfferedDurationsRaw] = useState("");
  const [achievementsRaw, setAchievementsRaw] = useState("");
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([
    { day: 1, from: "09:00", to: "12:00", busy: false },
  ]);
  const [age, setAge] = useState<number>(25);
  const [experienceYears, setExperienceYears] = useState<number>(5);
  const [totalLessons, setTotalLessons] = useState<number>(100);
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [supportContact, setSupportContact] = useState("");
  const [legalInfo, setLegalInfo] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [videoVisitUrl, setVideoVisitUrl] = useState("");
  const [hourlyRate, setHourlyRate] = useState<number>(2500);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoGallery, setPhotoGallery] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [dragPhotoUrl, setDragPhotoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [inited, setInited] = useState(false);
  /** Иначе Chrome подставляет «чужие» имя/фамилию из профиля браузера в поля с id вроде first-name. */
  const [publicNameFieldsUnlocked, setPublicNameFieldsUnlocked] = useState(false);
  const [pendingPromptOrderId, setPendingPromptOrderId] = useState<string | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number>(20);
  const seenPendingOrderIdsRef = useRef<Set<string>>(new Set());

  const effectiveOnline = online ?? data?.isOnline ?? false;

  useThrottledInstructorLocation(effectiveOnline);

  useEffect(() => {
    const pending = (orderAlerts?.orders ?? []).filter((o) => o.status === "PENDING_INSTRUCTOR");
    const pendingIds = new Set(pending.map((o) => o.id));
    for (const knownId of [...seenPendingOrderIdsRef.current]) {
      if (!pendingIds.has(knownId)) seenPendingOrderIdsRef.current.delete(knownId);
    }
    const newlySeen = pending.find((o) => !seenPendingOrderIdsRef.current.has(o.id));
    for (const p of pending) seenPendingOrderIdsRef.current.add(p.id);
    if (newlySeen) {
      setPendingPromptOrderId(newlySeen.id);
      setEtaMinutes(20);
    }
  }, [orderAlerts?.orders]);

  const activePendingPromptOrder =
    orderAlerts?.orders.find((o) => o.id === pendingPromptOrderId && o.status === "PENDING_INSTRUCTOR") ?? null;
  const pendingRelaxedTiming = Boolean(
    activePendingPromptOrder &&
      orderRelaxedInstructorTiming({
        flexibleInstructorInvite: Boolean(activePendingPromptOrder.flexibleInstructorInvite),
        requestedDays: activePendingPromptOrder.requestedDays ?? null,
      }),
  );
  const [pendingPromptSecondsLeft, setPendingPromptSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!pendingPromptOrderId) return;
    if (activePendingPromptOrder) return;
    setPendingPromptOrderId(null);
  }, [activePendingPromptOrder, pendingPromptOrderId]);

  useEffect(() => {
    if (!activePendingPromptOrder || pendingRelaxedTiming) {
      setPendingPromptSecondsLeft(null);
      return;
    }
    const expRaw = activePendingPromptOrder.pendingExpiresAt;
    if (!expRaw) {
      setPendingPromptSecondsLeft(null);
      return;
    }
    const expMs = new Date(expRaw).getTime();
    if (!Number.isFinite(expMs)) {
      setPendingPromptSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((expMs - Date.now()) / 1000));
      setPendingPromptSecondsLeft(left);
    };
    tick();
    const timerId = window.setInterval(tick, 1000);
    return () => window.clearInterval(timerId);
  }, [activePendingPromptOrder, pendingRelaxedTiming]);

  useEffect(() => {
    if (!activePendingPromptOrder || pendingRelaxedTiming) return;
    if (pendingPromptSecondsLeft == null || pendingPromptSecondsLeft > 0) return;
    setPendingPromptOrderId(null);
    setPendingPromptSecondsLeft(null);
    toast.info("Время ответа истекло. Заявка передана следующему инструктору.");
    void qc.invalidateQueries({ queryKey: ["instructor-order-alerts"] });
    void qc.invalidateQueries({ queryKey: ["orders"] });
  }, [activePendingPromptOrder, pendingPromptSecondsLeft, pendingRelaxedTiming, qc]);

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
      toast.success("Уведомления уже включены");
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
      toast.success("Браузерные уведомления включены");
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
    setSpecializationsRaw(data.profile.specializations.join(", "));
    setAdditionalServicesRaw(data.profile.additionalServices.join(", "));
    setOfferedDurationsRaw(data.profile.offeredDurations.join(", "));
    setAchievementsRaw(data.profile.achievements.join(", "));
    setAge(data.profile.age ?? 25);
    setExperienceYears(data.profile.experienceYears ?? 5);
    setTotalLessons(data.profile.totalLessons ?? 100);
    setCancellationPolicy(data.profile.cancellationPolicy ?? "");
    setSupportContact(data.profile.supportContact ?? "");
    setLegalInfo(data.profile.legalInfo ?? "");
    setTelegramUrl(data.profile.telegramUrl ?? "");
    setWhatsappUrl(data.profile.whatsappUrl ?? "");
    setInstagramUrl(data.profile.instagramUrl ?? "");
    setVideoVisitUrl(data.profile.videoVisitUrl ?? "");
    setAvailabilitySlots(
      data.profile.availabilitySlots?.length
        ? data.profile.availabilitySlots
        : [{ day: 1, from: "09:00", to: "12:00", busy: false }]
    );
    setHourlyRate(data.profile.hourlyRate);
    setPhotoUrl(data.profile.photoUrl ?? "");
    setPhotoGallery(data.profile.photoGallery ?? []);
    setPublicNameFieldsUnlocked(false);
    setInited(true);
  }, [data?.profile, inited]);

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const r = await fetch("/api/instructor/online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: next }),
      });
      if (!r.ok) throw new Error("toggle");
      return next;
    },
    onSuccess: (next) => {
      setOnline(next);
      void qc.invalidateQueries({ queryKey: ["io-online"] });
      toast.success(next ? "Вы на линии" : "Офлайн");
    },
    onError: () => toast.error("Не удалось обновить статус"),
  });

  function validateProfileForm(): { ok: boolean; availabilitySlots: AvailabilitySlot[] } {
    const errors: Partial<Record<ProfileField, string>> = {};
    const isValidUrl = (v: string): boolean => {
      if (!v.trim()) return true;
      try {
        new URL(v.trim());
        return true;
      } catch {
        return false;
      }
    };

    if (!certificationLevel.trim()) errors.certificationLevel = "Укажите уровень сертификации";
    if (!languagesRaw.trim()) errors.languagesRaw = "Укажите хотя бы один язык";
    if (!specializationsRaw.trim()) errors.specializationsRaw = "Укажите хотя бы одну специализацию";
    if (!(hourlyRate >= 500)) errors.hourlyRate = "Минимум 500 ₽/ч";
    if (age > 0 && (age < 14 || age > 90)) errors.age = "Возраст должен быть от 14 до 90";

    const normalizedSlots = availabilitySlots
      .map((slot) => ({ ...slot, from: slot.from.trim(), to: slot.to.trim(), busy: false }))
      .filter((slot) => slot.from && slot.to);

    if (!normalizedSlots.length) {
      errors.availabilityRaw = "Добавьте хотя бы один свободный интервал в календаре";
    } else {
      const invalidSlot = normalizedSlots.find(
        (slot) =>
          slot.day < 0 ||
          slot.day > 6 ||
          !/^\d{2}:\d{2}$/.test(slot.from) ||
          !/^\d{2}:\d{2}$/.test(slot.to) ||
          slot.from >= slot.to
      );
      if (invalidSlot) {
        errors.availabilityRaw = "Проверьте интервалы: формат ЧЧ:ММ и время 'с' меньше времени 'до'";
      }
    }

    if (!isValidUrl(telegramUrl)) errors.telegramUrl = "Некорректный URL";
    if (!isValidUrl(whatsappUrl)) errors.whatsappUrl = "Некорректный URL";
    if (!isValidUrl(instagramUrl)) errors.instagramUrl = "Некорректный URL";
    if (!isValidUrl(videoVisitUrl)) errors.videoVisitUrl = "Некорректный URL";

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
    mutationFn: async () => {
      const validation = validateProfileForm();
      if (!validation.ok) {
        throw new Error("Проверьте поля, выделенные красным");
      }

      const languages = languagesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const specializations = specializationsRaw
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

      const r = await fetch("/api/instructor/me", {
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
          specializations,
          additionalServices,
          offeredDurations,
          achievements,
          age: age >= 14 ? age : undefined,
          experienceYears,
          totalLessons,
          availabilitySlots,
          cancellationPolicy,
          supportContact,
          legalInfo,
          telegramUrl,
          whatsappUrl,
          instagramUrl,
          videoVisitUrl,
          hourlyRate,
          photoUrl,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as {
          error?: unknown;
          details?: unknown;
        };
        if (typeof j.error === "string") {
          throw new Error(j.error);
        }
        throw new Error("Не удалось сохранить профиль (подробности в логах сервера)");
      }
    },
    onSuccess: async () => {
      setFieldErrors({});
      toast.success("Профиль обновлён");
      await qc.invalidateQueries({ queryKey: ["io-online"] });
      await qc.refetchQueries({ queryKey: ["io-online"] });
      setInited(false);
      await qc.invalidateQueries({ queryKey: ["nearby"], exact: false });
    },
    onError: (e: Error) =>
      toast.error(e.message || "Не удалось сохранить профиль"),
  });

  const uploadPhoto = useMutation({
    mutationFn: async () => {
      if (!photoFile) throw new Error("file");
      const toUpload = await compressImageFile(photoFile);
      const fd = new FormData();
      fd.append("file", toUpload);
      const r = await fetch("/api/instructor/photo", {
        method: "POST",
        body: fd,
      });
      const j = (await r.json().catch(() => ({}))) as {
        photoUrl?: string;
        photoGallery?: string[];
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
      toast.success("Фото загружено");
      await qc.invalidateQueries({ queryKey: ["io-online"] });
      await qc.refetchQueries({ queryKey: ["io-online"] });
      setInited(false);
      await qc.invalidateQueries({ queryKey: ["nearby"], exact: false });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePhoto = useMutation({
    mutationFn: async (urlToRemove?: string) => {
      const r = await fetch(
        urlToRemove
          ? `/api/instructor/photo?photoUrl=${encodeURIComponent(urlToRemove)}`
          : "/api/instructor/photo",
        { method: "DELETE" }
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
      const r = await fetch("/api/instructor/photo", {
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

  const respondToPendingOrder = useMutation({
    mutationFn: async (payload: { orderId: string; action: "accept" | "reject"; etaMinutes?: number }) => {
      const body =
        payload.action === "accept"
          ? payload.etaMinutes != null &&
              Number.isFinite(payload.etaMinutes) &&
              payload.etaMinutes > 0
            ? { action: "accept" as const, etaMinutes: payload.etaMinutes }
            : { action: "accept" as const }
          : { action: "reject" as const };
      const r = await fetch(`/api/orders/${payload.orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось обновить заказ");
      return payload;
    },
    onSuccess: async ({ orderId, action }) => {
      await qc.invalidateQueries({ queryKey: ["instructor-order-alerts"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      if (action === "accept") {
        toast.success("Заявка принята");
        setPendingPromptOrderId(null);
        router.push(`/instructor/orders/${orderId}`);
      } else {
        toast.success("Заявка отклонена");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Финансы (выплаченные заказы)</CardTitle>
          <CardDescription>Доля инструктора после комиссии платформы.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Завершённых оплаченных: {stats?.orders ?? "…"}</div>
          <div>Ваша доля: {stats ? `${stats.instructorShareTotal.toFixed(0)} ₽` : "…"}</div>
          <div className="text-muted-foreground">
            Оборот по вашим заказам: {stats ? `${stats.grossTotal.toFixed(0)} ₽` : "…"}
          </div>
        </CardContent>
      </Card>

      <Card>
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

      <Card>
        <CardHeader>
          <CardTitle>Доступность</CardTitle>
          <CardDescription>Онлайн — вы видны клиентам на карте (в радиусе и при одобренной верификации).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {isLoading && data == null && online == null ? (
            <Skeleton className="h-10 w-40" />
          ) : (
            <>
              <Button
                type="button"
                variant={effectiveOnline ? "default" : "outline"}
                onClick={() => toggle.mutate(!effectiveOnline)}
                disabled={toggle.isPending}
                aria-pressed={effectiveOnline}
              >
                {effectiveOnline ? "Онлайн" : "Офлайн"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Разрешите доступ к геолокации в браузере — иначе клиенты не увидят вас рядом.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-sky-50/70 to-background dark:from-slate-900">
        <CardHeader>
          <CardTitle>Профиль инструктора (для клиентов)</CardTitle>
          <CardDescription>
            Заполните навыки и описание — это показывается в раскрытом профиле в меню заказа.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <div className="space-y-2">
                  <Label htmlFor="rate">Цена за час (₽)</Label>
                  <Input
                    id="rate"
                    type="number"
                    min={500}
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
                    className={cn(fieldErrors.hourlyRate && "border-destructive ring-destructive")}
                  />
                  {fieldErrors.hourlyRate ? (
                    <p className="text-xs text-destructive">{fieldErrors.hourlyRate}</p>
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
                  <Label htmlFor="exp">Стаж (лет)</Label>
                  <Input id="exp" type="number" value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lessons">Проведено занятий</Label>
                  <Input id="lessons" type="number" value={totalLessons} onChange={(e) => setTotalLessons(Number(e.target.value) || 0)} />
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

              <MultiSelectChipsField
                id="spec"
                label="Специализации"
                value={specializationsRaw}
                onChange={(next) => {
                  setSpecializationsRaw(next);
                  setBio((b) => syncSeedLikeBioFromSpecsCsv(b, next));
                }}
                options={[...INSTRUCTOR_ACTIVITY_LABELS]}
                placeholder="Горные лыжи, Сноуборд, Фрирайд, Дети"
                error={fieldErrors.specializationsRaw}
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
                <Label htmlFor="photo">Фото (URL)</Label>
                <Input
                  id="photo"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Input
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
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Календарь доступности</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={fillWeekdays}>
                      Будни 09:00-18:00
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAvailabilitySlots([])}
                    >
                      Очистить
                    </Button>
                  </div>
                </div>
                <div
                  className={cn(
                    "grid gap-2 rounded-md border border-border p-3 md:grid-cols-2 xl:grid-cols-7",
                    fieldErrors.availabilityRaw && "border-destructive"
                  )}
                >
                  {FULL_DAY_LABELS.map((dayLabel, day) => {
                    const daySlots = availabilitySlots
                      .map((slot, index) => ({ slot, index }))
                      .filter(({ slot }) => slot.day === day);
                    return (
                      <div key={dayLabel} className="rounded-md border border-border bg-muted/20 p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="inline-flex items-center gap-1 text-xs font-medium">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {dayLabel}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => addSlotForDay(day)}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Слот
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {!daySlots.length ? (
                            <p className="text-xs text-muted-foreground">Нет свободных интервалов</p>
                          ) : (
                            daySlots.map(({ slot, index }) => (
                              <div key={`${day}-${index}`} className="rounded border border-border bg-background p-2">
                                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">С</Label>
                                    <Input
                                      type="time"
                                      value={slot.from}
                                      onChange={(e) => updateSlot(index, { from: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">До</Label>
                                    <Input
                                      type="time"
                                      value={slot.to}
                                      onChange={(e) => updateSlot(index, { to: e.target.value })}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeSlot(index)}
                                    aria-label="Удалить интервал"
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {fieldErrors.availabilityRaw ? (
                  <p className="text-xs text-destructive">{fieldErrors.availabilityRaw}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Отмечайте свободные интервалы на каждый день недели. Эти окна увидят клиенты.
                  </p>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="policy">Политика отмены</Label>
                  <Input id="policy" value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support">Контакты техподдержки</Label>
                  <Input id="support" value={supportContact} onChange={(e) => setSupportContact(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal">Юридическая информация</Label>
                <Input id="legal" value={legalInfo} onChange={(e) => setLegalInfo(e.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tg">Telegram URL</Label>
                  <Input id="tg" value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} className={cn(fieldErrors.telegramUrl && "border-destructive ring-destructive")} />
                  {fieldErrors.telegramUrl ? <p className="text-xs text-destructive">{fieldErrors.telegramUrl}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa">WhatsApp URL</Label>
                  <Input id="wa" value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} className={cn(fieldErrors.whatsappUrl && "border-destructive ring-destructive")} />
                  {fieldErrors.whatsappUrl ? <p className="text-xs text-destructive">{fieldErrors.whatsappUrl}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ig">Instagram URL</Label>
                  <Input id="ig" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={cn(fieldErrors.instagramUrl && "border-destructive ring-destructive")} />
                  {fieldErrors.instagramUrl ? <p className="text-xs text-destructive">{fieldErrors.instagramUrl}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yt">Видео-визитка (YouTube URL)</Label>
                  <Input id="yt" value={videoVisitUrl} onChange={(e) => setVideoVisitUrl(e.target.value)} className={cn(fieldErrors.videoVisitUrl && "border-destructive ring-destructive")} />
                  {fieldErrors.videoVisitUrl ? <p className="text-xs text-destructive">{fieldErrors.videoVisitUrl}</p> : null}
                </div>
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
                  disabled={saveProfile.isPending}
                  onClick={() => saveProfile.mutate()}
                >
                  Сохранить профиль
                </Button>
              </div>
            </>
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

      {activePendingPromptOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-background p-4 shadow-xl">
            <h2 className="text-lg font-semibold">Новая заявка от клиента</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Клиент: {activePendingPromptOrder.client?.name || "Без имени"}
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-2 md:grid-cols-2">
                <div>
                  <span className="text-xs text-muted-foreground">Статус</span>
                  <div className="font-medium">
                    {orderStatusLabel(activePendingPromptOrder.status as OrderStatus)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Создан</span>
                  <div className="font-medium">
                    {new Date(activePendingPromptOrder.createdAt).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Курорт</span>
                  <div className="font-medium">{activePendingPromptOrder.resort?.name ?? "Не указан"}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Сумма</span>
                  <div className="font-medium">
                    {activePendingPromptOrder.amountTotal ? `${Number(activePendingPromptOrder.amountTotal)} ₽` : "—"}
                  </div>
                </div>
              </div>
              <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-2 md:grid-cols-3">
                <div>
                  <span className="text-xs text-muted-foreground">Уровень</span>
                  <div className="font-medium">{activePendingPromptOrder.skillLevel}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Язык</span>
                  <div className="font-medium">{activePendingPromptOrder.languagePref}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Длительность</span>
                  <div className="font-medium">{activePendingPromptOrder.duration}</div>
                </div>
              </div>
              <div>
                Точка встречи: {activePendingPromptOrder.meetLat.toFixed(5)}, {activePendingPromptOrder.meetLng.toFixed(5)}
              </div>
              {!pendingRelaxedTiming ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-medium text-amber-800 dark:text-amber-200">
                  На ознакомление и решение: {pendingPromptSecondsLeft ?? 0} сек
                </div>
              ) : activePendingPromptOrder.flexibleInstructorInvite ? (
                <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 font-medium text-sky-900 dark:text-sky-200">
                  Запись на дату без таймера ответа
                </div>
              ) : (
                <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 font-medium text-sky-900 dark:text-sky-200">
                  Несколько дней — без таймера 60 с; ETA до клиента при принятии не запрашивается
                </div>
              )}
              {activePendingPromptOrder.requestedStartDate ? (
                <div>
                  Даты: {new Date(activePendingPromptOrder.requestedStartDate).toLocaleDateString("ru-RU")}
                  {activePendingPromptOrder.requestedEndDate
                    ? ` - ${new Date(activePendingPromptOrder.requestedEndDate).toLocaleDateString("ru-RU")}`
                    : ""}
                  {activePendingPromptOrder.requestedDays
                    ? ` (${activePendingPromptOrder.requestedDays} дн.)`
                    : ""}
                </div>
              ) : null}
              {hasLessonTimeWindowInNotes(activePendingPromptOrder.notes) ? (
                <div>
                  <span className="font-medium">{lessonTimeWindowLineFromNotes(activePendingPromptOrder.notes)}</span>
                </div>
              ) : null}
              {activePendingPromptOrder.notes ? (
                <p className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                  {activePendingPromptOrder.notes}
                </p>
              ) : null}
            </div>

            {!pendingRelaxedTiming ? (
              <div className="mt-4 space-y-2">
                <Label htmlFor="eta-minutes">Через сколько минут сможете быть у клиента</Label>
                <Input
                  id="eta-minutes"
                  type="number"
                  min={1}
                  max={240}
                  value={etaMinutes}
                  onChange={(e) => setEtaMinutes(Math.min(240, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingPromptOrderId(null)}
                disabled={respondToPendingOrder.isPending}
              >
                Позже
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  respondToPendingOrder.mutate({ orderId: activePendingPromptOrder.id, action: "reject" })
                }
                disabled={respondToPendingOrder.isPending}
              >
                Отклонить
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={() =>
                  respondToPendingOrder.mutate({
                    orderId: activePendingPromptOrder.id,
                    action: "accept",
                    ...(pendingRelaxedTiming ? {} : { etaMinutes }),
                  })
                }
                disabled={
                  respondToPendingOrder.isPending ||
                  (!pendingRelaxedTiming &&
                    pendingPromptSecondsLeft !== null &&
                    pendingPromptSecondsLeft <= 0)
                }
              >
                Подтвердить и открыть заказ
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
