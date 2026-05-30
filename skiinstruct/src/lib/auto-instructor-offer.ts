import { normalizeText } from "@/lib/services/instructor-match";

/** Каноническое направление в каталоге и в specializationOffers. */
export const AUTO_INSTRUCTOR_LABEL = "🚗 Автоинструктор";

export const DRIVING_VEHICLE_OPTIONS = [
  { id: "INSTRUCTOR_CAR" as const, label: "На авто инструктора" },
  { id: "STUDENT_CAR" as const, label: "На авто ученика (моё авто)" },
];

export const DRIVING_TRANSMISSION_OPTIONS = [
  { id: "MANUAL" as const, label: "МКПП" },
  { id: "AUTOMATIC" as const, label: "АКПП" },
  { id: "ANY" as const, label: "Любое КПП" },
];

export const DRIVING_LICENSE_CATEGORIES = [
  { id: "M" as const, label: "M", hint: "Мопеды и лёгкие квадрициклы" },
  { id: "A" as const, label: "A", hint: null },
  { id: "B" as const, label: "B", hint: null },
  { id: "C" as const, label: "C", hint: null },
  { id: "D" as const, label: "D", hint: null },
  { id: "BE_CE_DE" as const, label: "BE, CE, DE", hint: null },
  { id: "C1_D1" as const, label: "C1, D1", hint: null },
  { id: "TM" as const, label: "Tm", hint: null },
  { id: "TB" as const, label: "Tb", hint: null },
] as const;

export type DrivingVehicleOption = (typeof DRIVING_VEHICLE_OPTIONS)[number]["id"];
export type DrivingTransmissionOption = (typeof DRIVING_TRANSMISSION_OPTIONS)[number]["id"];
export type DrivingLicenseCategory = (typeof DRIVING_LICENSE_CATEGORIES)[number]["id"];

export type DrivingSchoolOfferDetails = {
  vehicleOptions: DrivingVehicleOption[];
  transmissions: DrivingTransmissionOption[];
  licenseCategories: DrivingLicenseCategory[];
};

const VEHICLE_IDS = new Set<DrivingVehicleOption>(DRIVING_VEHICLE_OPTIONS.map((o) => o.id));
const TRANSMISSION_IDS = new Set<DrivingTransmissionOption>(DRIVING_TRANSMISSION_OPTIONS.map((o) => o.id));
const CATEGORY_IDS = new Set<DrivingLicenseCategory>(DRIVING_LICENSE_CATEGORIES.map((o) => o.id));

export function isAutoInstructorLabel(label: string): boolean {
  const canon = canonicalizeAutoInstructorLabel(label);
  return canon === AUTO_INSTRUCTOR_LABEL;
}

/** Сопоставление вариантов ввода с каноном «Автоинструктор». */
export function canonicalizeAutoInstructorLabel(raw: string): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (t === AUTO_INSTRUCTOR_LABEL) return AUTO_INSTRUCTOR_LABEL;
  const n = normalizeText(t);
  if (!n) return null;
  if (normalizeText(AUTO_INSTRUCTOR_LABEL) === n) return AUTO_INSTRUCTOR_LABEL;
  if (
    (n.includes("авто") && n.includes("инструкт")) ||
    n === "автоинструктор" ||
    n.includes("обучен") && n.includes("вожден")
  ) {
    return AUTO_INSTRUCTOR_LABEL;
  }
  return null;
}

export function defaultDrivingSchoolDetails(): DrivingSchoolOfferDetails {
  return {
    vehicleOptions: ["INSTRUCTOR_CAR"],
    transmissions: ["ANY"],
    licenseCategories: ["B"],
  };
}

function uniqueValid<T extends string>(values: unknown, allowed: Set<T>): T[] {
  if (!Array.isArray(values)) return [];
  const out: T[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const id = v as T;
    if (!allowed.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

export function parseDrivingSchoolDetails(raw: unknown): DrivingSchoolOfferDetails | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const vehicleOptions = uniqueValid<DrivingVehicleOption>(o.vehicleOptions, VEHICLE_IDS);
  const transmissions = uniqueValid<DrivingTransmissionOption>(o.transmissions, TRANSMISSION_IDS);
  const licenseCategories = uniqueValid<DrivingLicenseCategory>(o.licenseCategories, CATEGORY_IDS);
  if (!vehicleOptions.length || !transmissions.length || !licenseCategories.length) {
    return undefined;
  }
  return { vehicleOptions, transmissions, licenseCategories };
}

export function normalizeDrivingSchoolDetails(
  raw: DrivingSchoolOfferDetails | undefined,
): DrivingSchoolOfferDetails {
  const parsed = raw ? parseDrivingSchoolDetails(raw) : undefined;
  return parsed ?? defaultDrivingSchoolDetails();
}

export function validateDrivingSchoolDetails(
  details: DrivingSchoolOfferDetails | undefined,
): string | null {
  if (!details) {
    return "Для «Автоинструктора» укажите авто, КПП и категории прав";
  }
  if (!details.vehicleOptions.length) return "Выберите, на чьём авто ведёте обучение";
  if (!details.transmissions.length) return "Укажите типы КПП (МКПП, АКПП или любое)";
  if (!details.licenseCategories.length) return "Выберите хотя бы одну категорию прав";
  return null;
}

function labelById<T extends { id: string; label: string }>(options: readonly T[], id: string): string {
  return options.find((o) => o.id === id)?.label ?? id;
}

export function formatDrivingSchoolDetailsSummary(details: DrivingSchoolOfferDetails): string {
  const vehicles = details.vehicleOptions
    .map((id) => labelById(DRIVING_VEHICLE_OPTIONS, id))
    .join(", ");
  const transmissions = details.transmissions
    .map((id) => labelById(DRIVING_TRANSMISSION_OPTIONS, id))
    .join(", ");
  const categories = details.licenseCategories
    .map((id) => {
      const row = DRIVING_LICENSE_CATEGORIES.find((c) => c.id === id);
      if (!row) return id;
      return row.hint ? `${row.label} (${row.hint})` : row.label;
    })
    .join(", ");
  return `Авто: ${vehicles}. КПП: ${transmissions}. Категории: ${categories}`;
}
