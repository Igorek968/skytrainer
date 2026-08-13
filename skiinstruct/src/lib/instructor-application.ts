import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

import { buildInstructorProfileCreateData } from "@/lib/instructor-profile-defaults";
import {
  PASSPORT_UPLOAD_ALLOWED,
  PASSPORT_UPLOAD_MAX_BYTES,
  parseInstructorPassportInput,
  passportFileExt,
} from "@/lib/instructor-passport";
import { AGENCY_OFFER_VERSION } from "@/lib/legal-config";
import { normalizeRussianPhone } from "@/lib/phone";
import { writePrivateUpload } from "@/lib/private-uploads";
import { prisma } from "@/lib/prisma";
import { sendEmailVerification } from "@/lib/services/email-verification";
import { canonicalizeActivityLabel, canonicalizeActivityLabels } from "@/lib/services/instructor-match";
import { findDuplicateParticipantByDisplayName } from "@/lib/services/user-display-name-uniqueness";
import { validateUploadedBytes } from "@/lib/upload-validation";
import { DISPLAY_NAME_DUPLICATE_MESSAGE } from "@/lib/user-display-name";

const namePart = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{M}\s'-]+$/u, "Только буквы, пробел, дефис или апостроф");

const applySchema = z.object({
  email: z.string().trim().email("Некорректный email").max(254).transform((s) => s.toLowerCase()),
  password: z.string().min(8, "Пароль: не меньше 8 символов").max(128),
  lastName: namePart.refine((s) => s.length >= 1, { message: "Укажите фамилию" }),
  firstName: namePart.refine((s) => s.length >= 1, { message: "Укажите имя" }),
  middleName: namePart.refine((s) => s.length >= 1, { message: "Укажите отчество (как в паспорте)" }),
  nickname: z
    .string()
    .trim()
    .min(2, "Укажите никнейм (от 2 символов)")
    .max(80),
  bio: z.string().trim().min(20, "Кратко опишите опыт (от 20 символов)").max(4000),
  hourlyRate: z.coerce.number().min(500, "Минимальная ставка 500 ₽/ч").max(500_000),
  primarySpecialization: z.string().trim().min(1, "Выберите направление"),
  achievementsRaw: z.string().trim().max(2000).optional(),
  taxStatus: z.enum(["SELF_EMPLOYED", "IP"], {
    errorMap: () => ({ message: "Укажите налоговый статус" }),
  }),
  inn: z
    .string()
    .trim()
    .regex(/^\d{10}$|^\d{12}$/, "Укажите ИНН (10 или 12 цифр) — без него заявка на модерацию не отправляется"),
  phone: z
    .string()
    .trim()
    .min(1, "Укажите номер телефона")
    .max(32)
    .transform((raw, ctx) => {
      const normalized = normalizeRussianPhone(raw);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите российский мобильный: +7XXXXXXXXXX",
        });
        return z.NEVER;
      }
      return normalized;
    }),
});

export type CreateInstructorApplicationResult =
  | { ok: true; email: string }
  | { ok: false; error: string; status: 400 | 409 };

export async function createInstructorApplication(input: {
  email: string;
  password: string;
  passwordConfirm?: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  nickname: string;
  bio: string;
  hourlyRate: number;
  primarySpecialization: string;
  extraSpecializations?: string[];
  achievementsRaw?: string;
  acceptAgencyOffer?: boolean;
  acceptPrivacy?: boolean;
  taxStatus?: "SELF_EMPLOYED" | "IP";
  inn?: string;
  phone?: string;
  birthDate?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedAt?: string;
  passportDepartmentCode?: string;
  /** Скан/фото разворота паспорта (стр. 2–3). */
  passportScan?: File | null;
  /** Справка НПД («Мой налог») или выписка ЕГРИП. */
  taxDocumentScan?: File | null;
  /** UTM / источник заявки (Авито, Директ, SEO…). */
  acquisition?: Record<string, string>;
}): Promise<CreateInstructorApplicationResult> {
  if (!input.acceptAgencyOffer || !input.acceptPrivacy) {
    return {
      ok: false,
      error: "Необходимо принять договор для инструктора и политику обработки персональных данных",
      status: 400,
    };
  }

  if (input.passwordConfirm !== undefined && input.password !== input.passwordConfirm) {
    return { ok: false, error: "Пароли не совпадают", status: 400 };
  }

  const passportParsed = parseInstructorPassportInput({
    birthDate: input.birthDate,
    passportSeries: input.passportSeries,
    passportNumber: input.passportNumber,
    passportIssuedAt: input.passportIssuedAt,
    passportDepartmentCode: input.passportDepartmentCode,
  });
  if (!passportParsed.ok) {
    return { ok: false, error: passportParsed.error, status: 400 };
  }

  const passportScan = input.passportScan;
  if (!(passportScan instanceof File) || passportScan.size <= 0) {
    return {
      ok: false,
      error: "Прикрепите фото или скан паспорта (разворот стр. 2–3)",
      status: 400,
    };
  }
  if (!PASSPORT_UPLOAD_ALLOWED.has(passportScan.type)) {
    return { ok: false, error: "Паспорт: допустимы JPG, PNG, WEBP или PDF", status: 400 };
  }
  if (passportScan.size > PASSPORT_UPLOAD_MAX_BYTES) {
    return { ok: false, error: "Файл паспорта: максимум 8 MB", status: 400 };
  }
  const passportBuffer = Buffer.from(await passportScan.arrayBuffer());
  if (!validateUploadedBytes(passportScan.type, passportBuffer)) {
    return { ok: false, error: "Содержимое файла паспорта не соответствует формату", status: 400 };
  }

  const taxDocumentScan = input.taxDocumentScan;
  if (!(taxDocumentScan instanceof File) || taxDocumentScan.size <= 0) {
    return {
      ok: false,
      error: "Прикрепите документ НПД («Мой налог») или выписку ЕГРИП",
      status: 400,
    };
  }
  if (!PASSPORT_UPLOAD_ALLOWED.has(taxDocumentScan.type)) {
    return { ok: false, error: "Документ НПД/ИП: допустимы JPG, PNG, WEBP или PDF", status: 400 };
  }
  if (taxDocumentScan.size > PASSPORT_UPLOAD_MAX_BYTES) {
    return { ok: false, error: "Файл НПД/ИП: максимум 8 MB", status: 400 };
  }
  const taxDocumentBuffer = Buffer.from(await taxDocumentScan.arrayBuffer());
  if (!validateUploadedBytes(taxDocumentScan.type, taxDocumentBuffer)) {
    return { ok: false, error: "Содержимое файла НПД/ИП не соответствует формату", status: 400 };
  }

  const parsed = applySchema.safeParse({
    email: input.email,
    password: input.password,
    lastName: input.lastName,
    firstName: input.firstName,
    middleName: input.middleName ?? "",
    nickname: input.nickname,
    bio: input.bio,
    hourlyRate: input.hourlyRate,
    primarySpecialization: input.primarySpecialization,
    achievementsRaw: input.achievementsRaw,
    taxStatus: input.taxStatus,
    inn: input.inn?.replace(/\D/g, "") ?? "",
    phone: input.phone ?? "",
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      flat.fieldErrors.email?.[0] ??
      flat.fieldErrors.password?.[0] ??
      flat.fieldErrors.lastName?.[0] ??
      flat.fieldErrors.firstName?.[0] ??
      flat.fieldErrors.middleName?.[0] ??
      flat.fieldErrors.nickname?.[0] ??
      flat.fieldErrors.bio?.[0] ??
      flat.fieldErrors.hourlyRate?.[0] ??
      flat.fieldErrors.primarySpecialization?.[0] ??
      flat.fieldErrors.taxStatus?.[0] ??
      flat.fieldErrors.inn?.[0] ??
      flat.fieldErrors.phone?.[0] ??
      "Заполните все обязательные поля анкеты";
    return { ok: false, error: msg, status: 400 };
  }

  const primary = canonicalizeActivityLabel(parsed.data.primarySpecialization);
  if (!primary) {
    return { ok: false, error: "Выберите направление из списка", status: 400 };
  }

  const extras = canonicalizeActivityLabels(input.extraSpecializations ?? []);
  const specializations = canonicalizeActivityLabels([primary, ...extras]);

  const achievements = (parsed.data.achievementsRaw ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 20);

  const {
    email,
    password,
    lastName,
    firstName,
    middleName,
    nickname,
    bio,
    hourlyRate,
    taxStatus,
    inn,
    phone,
  } = parsed.data;
  const {
    birthDate,
    passportSeries,
    passportNumber,
    passportIssuedAt,
    passportDepartmentCode,
  } = passportParsed.data;

  const duplicateName = await findDuplicateParticipantByDisplayName(null, firstName, lastName);
  if (duplicateName) {
    return { ok: false, error: DISPLAY_NAME_DUPLICATE_MESSAGE, status: 409 };
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (existing) {
    if (existing.role === "INSTRUCTOR") {
      return { ok: false, error: "Этот email уже зарегистрирован как инструктор", status: 409 };
    }
    return { ok: false, error: "Этот email уже используется. Войдите или укажите другой email.", status: 409 };
  }

  const phoneTaken = await prisma.user.findFirst({
    where: { phone },
    select: { id: true },
  });
  if (phoneTaken) {
    return { ok: false, error: "Этот номер телефона уже используется", status: 409 };
  }

  const passwordHash = await hash(password, 12);
  /** Системное имя для уникальности и кабинета: Имя Фамилия. */
  const systemName = `${firstName} ${lastName}`.trim();
  const profileDraft = {
    firstName,
    lastName,
    middleName,
    nickname,
    ...(input.acquisition && Object.keys(input.acquisition).length > 0
      ? { acquisition: input.acquisition }
      : {}),
  };

  let createdUserId: string;
  try {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: systemName,
        middleName,
        nickname,
        phone,
        birthDate,
        role: "INSTRUCTOR",
        instructorProfile: {
          create: {
            ...buildInstructorProfileCreateData({
              bio,
              hourlyRate,
              specializations,
              achievements,
              agencyOfferAcceptedAt: new Date(),
              agencyOfferVersion: AGENCY_OFFER_VERSION,
              taxStatus,
              inn,
              passportSeries,
              passportNumber,
              passportIssuedAt,
              passportDepartmentCode,
            }),
            profileDraft,
          },
        },
      },
      select: { id: true },
    });
    createdUserId = created.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;
      const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
      if (fields.some((f) => f.includes("phone"))) {
        return { ok: false, error: "Этот номер телефона уже используется", status: 409 };
      }
      return { ok: false, error: "Этот email уже зарегистрирован", status: 409 };
    }
    throw e;
  }

  try {
    const ext = passportFileExt(passportScan.type);
    const filename = `${createdUserId}-PASSPORT-${randomUUID()}.${ext}`;
    const fileUrl = await writePrivateUpload("compliance", filename, passportBuffer);
    await prisma.instructorComplianceDocument.create({
      data: {
        userId: createdUserId,
        type: "PASSPORT",
        fileUrl,
        status: "PENDING",
      },
    });
  } catch (e) {
    console.error("[instructor-apply] passport upload", e instanceof Error ? e.message : e);
    // Аккаунт уже создан — скан можно догрузить в кабинете.
  }

  try {
    const taxType = taxStatus === "IP" ? ("TAX_STATUS_IP" as const) : ("TAX_STATUS_NPD" as const);
    const ext = passportFileExt(taxDocumentScan.type);
    const filename = `${createdUserId}-${taxType}-${randomUUID()}.${ext}`;
    const fileUrl = await writePrivateUpload("compliance", filename, taxDocumentBuffer);
    await prisma.instructorComplianceDocument.create({
      data: {
        userId: createdUserId,
        type: taxType,
        fileUrl,
        status: "PENDING",
      },
    });
  } catch (e) {
    console.error("[instructor-apply] tax document upload", e instanceof Error ? e.message : e);
  }

  try {
    const { emitAdminNewInstructorAlert, emitAdminModerationProfileAlert } = await import(
      "@/lib/services/admin-alerts"
    );
    await emitAdminNewInstructorAlert({
      userId: createdUserId,
      displayName: systemName,
    });
    await emitAdminModerationProfileAlert({
      userId: createdUserId,
      displayName: systemName,
      kind: "NEW_ACCOUNT",
    });
  } catch (e) {
    console.error("[admin-alert] instructor apply", e instanceof Error ? e.message : e);
  }

  void import("@/lib/services/yookassa-instructor-contract-notify")
    .then(({ notifyYookassaInstructorContract }) =>
      notifyYookassaInstructorContract(createdUserId),
    )
    .catch((e) =>
      console.error("[yookassa-contract] apply", e instanceof Error ? e.message : e),
    );

  void sendEmailVerification(email).catch((e) => {
    console.error("[instructor-apply] email verification send failed", e);
  });

  return { ok: true, email };
}
