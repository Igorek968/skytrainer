/** Валидация паспортных данных РФ для анкеты инструктора. */

export type PassportFields = {
  birthDate: Date;
  passportSeries: string;
  passportNumber: string;
  passportIssuedAt: Date;
  passportDepartmentCode: string;
};

function parseIsoDateOnly(raw: string): Date | null {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const [y, m, day] = s.split("-").map(Number);
  if (d.getUTCFullYear() !== y || d.getUTCMonth() + 1 !== m || d.getUTCDate() !== day) return null;
  return d;
}

function ageYears(birth: Date, at: Date = new Date()): number {
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const m = at.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

/** Код подразделения → XXX-XXX */
export function normalizePassportDepartmentCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function parseInstructorPassportInput(input: {
  birthDate?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedAt?: string;
  passportDepartmentCode?: string;
}): { ok: true; data: PassportFields } | { ok: false; error: string } {
  const birthDate = parseIsoDateOnly(String(input.birthDate ?? ""));
  if (!birthDate) {
    return { ok: false, error: "Укажите дату рождения" };
  }
  if (ageYears(birthDate) < 18) {
    return { ok: false, error: "Инструктору должно быть не менее 18 лет" };
  }

  const passportSeries = String(input.passportSeries ?? "").replace(/\D/g, "");
  if (!/^\d{4}$/.test(passportSeries)) {
    return { ok: false, error: "Серия паспорта: 4 цифры" };
  }

  const passportNumber = String(input.passportNumber ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(passportNumber)) {
    return { ok: false, error: "Номер паспорта: 6 цифр" };
  }

  const passportIssuedAt = parseIsoDateOnly(String(input.passportIssuedAt ?? ""));
  if (!passportIssuedAt) {
    return { ok: false, error: "Укажите дату выдачи паспорта" };
  }
  if (passportIssuedAt.getTime() < birthDate.getTime()) {
    return { ok: false, error: "Дата выдачи паспорта не может быть раньше даты рождения" };
  }
  if (passportIssuedAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return { ok: false, error: "Дата выдачи паспорта не может быть в будущем" };
  }

  const passportDepartmentCode = normalizePassportDepartmentCode(
    String(input.passportDepartmentCode ?? ""),
  );
  if (!passportDepartmentCode) {
    return { ok: false, error: "Код подразделения: 6 цифр (формат XXX-XXX)" };
  }

  return {
    ok: true,
    data: {
      birthDate,
      passportSeries,
      passportNumber,
      passportIssuedAt,
      passportDepartmentCode,
    },
  };
}

export const PASSPORT_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const PASSPORT_UPLOAD_ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function passportFileExt(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}
