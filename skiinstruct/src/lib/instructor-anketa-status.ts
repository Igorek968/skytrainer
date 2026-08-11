/** Статус полноты анкеты инструктора для админки (договор / идентификация). */

export type InstructorAnketaFieldSnapshot = {
  name?: string | null;
  middleName?: string | null;
  phone?: string | null;
  email?: string | null;
  birthDate?: Date | string | null;
  inn?: string | null;
  taxStatus?: string | null;
  passportSeries?: string | null;
  passportNumber?: string | null;
  passportIssuedAt?: Date | string | null;
  passportDepartmentCode?: string | null;
  bio?: string | null;
  hasPassportScan?: boolean;
  hasTaxDocument?: boolean;
};

export function instructorAnketaMissingFields(s: InstructorAnketaFieldSnapshot): string[] {
  const missing: string[] = [];
  if (!s.name?.trim()) missing.push("ФИО");
  if (!s.phone?.trim()) missing.push("Телефон");
  if (!s.email?.trim()) missing.push("Email");
  if (!s.birthDate) missing.push("Дата рождения");
  if (!s.inn?.trim()) missing.push("ИНН");
  if (!s.taxStatus) missing.push("Налоговый статус");
  if (!s.passportSeries?.trim()) missing.push("Серия паспорта");
  if (!s.passportNumber?.trim()) missing.push("Номер паспорта");
  if (!s.passportIssuedAt) missing.push("Дата выдачи паспорта");
  if (!s.passportDepartmentCode?.trim()) missing.push("Код подразделения");
  if (!s.bio?.trim() || s.bio.trim().length < 20) missing.push("О себе");
  if (s.hasPassportScan === false) missing.push("Скан паспорта");
  if (s.hasTaxDocument === false) missing.push("Справка НПД / ЕГРИП");
  return missing;
}

export function instructorAnketaIsComplete(s: InstructorAnketaFieldSnapshot): boolean {
  return instructorAnketaMissingFields(s).length === 0;
}
