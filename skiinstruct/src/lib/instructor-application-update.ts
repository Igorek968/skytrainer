import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  PASSPORT_UPLOAD_ALLOWED,
  PASSPORT_UPLOAD_MAX_BYTES,
  parseInstructorPassportInput,
  passportFileExt,
} from "@/lib/instructor-passport";
import { parseProfileDraft } from "@/lib/instructor-profile-draft";
import { formatRussianPhoneDisplay, normalizeRussianPhone } from "@/lib/phone";
import { writePrivateUpload } from "@/lib/private-uploads";
import { prisma } from "@/lib/prisma";
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

const updateSchema = z.object({
  lastName: namePart,
  firstName: namePart,
  middleName: namePart,
  nickname: z.string().trim().min(2).max(80),
  bio: z.string().trim().min(20, "Кратко опишите опыт (от 20 символов)").max(4000),
  hourlyRate: z.coerce.number().min(500).max(500_000),
  primarySpecialization: z.string().trim().min(1, "Выберите направление"),
  achievementsRaw: z.string().trim().max(2000).optional(),
  taxStatus: z.enum(["SELF_EMPLOYED", "IP"]),
  inn: z.string().trim().regex(/^\d{10}$|^\d{12}$/, "Укажите ИНН (10 или 12 цифр)"),
  phone: z
    .string()
    .trim()
    .min(1)
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

function formatDateOnly(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export type InstructorApplicationFormData = {
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  nickname: string;
  phone: string;
  bio: string;
  hourlyRate: number;
  primarySpecialization: string;
  achievements: string;
  taxStatus: "SELF_EMPLOYED" | "IP";
  inn: string;
  birthDate: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedAt: string;
  passportDepartmentCode: string;
  hasPassportScan: boolean;
  hasTaxDocument: boolean;
  rejectNote: string | null;
};

export async function getInstructorApplicationForEdit(
  userId: string,
): Promise<
  | { ok: true; data: InstructorApplicationFormData; verificationStatus: "REJECTED" | "PENDING" }
  | { ok: false; error: string; status: 404 | 403 }
> {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "INSTRUCTOR" },
    select: {
      email: true,
      name: true,
      middleName: true,
      nickname: true,
      phone: true,
      birthDate: true,
      instructorProfile: {
        select: {
          verificationStatus: true,
          profileDraftRejectNote: true,
          bio: true,
          hourlyRate: true,
          specializations: true,
          achievements: true,
          taxStatus: true,
          inn: true,
          passportSeries: true,
          passportNumber: true,
          passportIssuedAt: true,
          passportDepartmentCode: true,
          profileDraft: true,
        },
      },
    },
  });

  if (!user?.instructorProfile) {
    return { ok: false, error: "Профиль не найден", status: 404 };
  }

  const p = user.instructorProfile;
  if (p.verificationStatus === "APPROVED") {
    return { ok: false, error: "Анкета уже одобрена", status: 403 };
  }
  if (p.verificationStatus !== "REJECTED" && p.verificationStatus !== "PENDING") {
    return { ok: false, error: "Редактирование недоступно", status: 403 };
  }

  const draft = parseProfileDraft(p.profileDraft);
  const nameParts = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = draft?.firstName?.trim() || nameParts[0] || "";
  const lastName =
    draft?.lastName?.trim() || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");
  const middleName = (draft?.middleName ?? user.middleName)?.trim() || "";
  const nickname = (draft?.nickname ?? user.nickname)?.trim() || "";
  const specs = canonicalizeActivityLabels(p.specializations);
  const primarySpecialization = specs[0] ?? "";

  const passportDoc = await prisma.instructorComplianceDocument.findFirst({
    where: { userId, type: "PASSPORT" },
    select: { id: true },
  });
  const taxDoc = await prisma.instructorComplianceDocument.findFirst({
    where: { userId, type: { in: ["TAX_STATUS_NPD", "TAX_STATUS_IP"] } },
    select: { id: true },
  });

  return {
    ok: true,
    verificationStatus: p.verificationStatus as "REJECTED" | "PENDING",
    data: {
      email: user.email,
      lastName,
      firstName,
      middleName,
      nickname,
      phone: formatRussianPhoneDisplay(user.phone ?? ""),
      bio: p.bio ?? "",
      hourlyRate: Number(p.hourlyRate) || 3000,
      primarySpecialization,
      achievements: (p.achievements ?? []).join("\n"),
      taxStatus: p.taxStatus === "IP" ? "IP" : "SELF_EMPLOYED",
      inn: p.inn ?? "",
      birthDate: formatDateOnly(user.birthDate),
      passportSeries: p.passportSeries ?? "",
      passportNumber: p.passportNumber ?? "",
      passportIssuedAt: formatDateOnly(p.passportIssuedAt),
      passportDepartmentCode: p.passportDepartmentCode ?? "",
      hasPassportScan: Boolean(passportDoc),
      hasTaxDocument: Boolean(taxDoc),
      rejectNote: p.profileDraftRejectNote,
    },
  };
}

export async function updateInstructorApplicationAndResubmit(input: {
  userId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  nickname: string;
  bio: string;
  hourlyRate: number | string;
  primarySpecialization: string;
  achievementsRaw?: string;
  taxStatus: string;
  inn: string;
  phone: string;
  birthDate?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedAt?: string;
  passportDepartmentCode?: string;
  passportScan?: File | null;
  taxDocumentScan?: File | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: 400 | 403 | 404 | 409 }> {
  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: input.userId },
    select: { verificationStatus: true, specializations: true, profileDraft: true },
  });
  if (!profile) {
    return { ok: false, error: "Профиль не найден", status: 404 };
  }
  if (profile.verificationStatus !== "REJECTED") {
    return {
      ok: false,
      error: "Редактирование анкеты доступно только после отказа модерации",
      status: 403,
    };
  }

  const parsed = updateSchema.safeParse({
    lastName: input.lastName,
    firstName: input.firstName,
    middleName: input.middleName,
    nickname: input.nickname,
    bio: input.bio,
    hourlyRate: input.hourlyRate,
    primarySpecialization: input.primarySpecialization,
    achievementsRaw: input.achievementsRaw,
    taxStatus: input.taxStatus,
    inn: input.inn,
    phone: input.phone,
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      Object.values(flat.fieldErrors)
        .flat()
        .find((m): m is string => typeof m === "string") ?? "Проверьте поля анкеты";
    return { ok: false, error: msg, status: 400 };
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

  const primary = canonicalizeActivityLabel(parsed.data.primarySpecialization);
  if (!primary) {
    return { ok: false, error: "Выберите направление", status: 400 };
  }

  const duplicate = await findDuplicateParticipantByDisplayName(
    input.userId,
    parsed.data.firstName,
    parsed.data.lastName,
  );
  if (duplicate) {
    return { ok: false, error: DISPLAY_NAME_DUPLICATE_MESSAGE, status: 409 };
  }

  const phoneTaken = await prisma.user.findFirst({
    where: { phone: parsed.data.phone, NOT: { id: input.userId } },
    select: { id: true },
  });
  if (phoneTaken) {
    return { ok: false, error: "Этот номер телефона уже используется", status: 409 };
  }

  const prevSpecs = canonicalizeActivityLabels(profile.specializations);
  const specializations = [primary, ...prevSpecs.filter((s) => s !== primary)].slice(0, 12);
  const achievements = (parsed.data.achievementsRaw ?? "")
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  const draftPrev = parseProfileDraft(profile.profileDraft);
  const profileDraft = {
    ...(draftPrev ?? {}),
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    middleName: parsed.data.middleName,
    nickname: parsed.data.nickname,
  };

  const systemName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          name: systemName,
          middleName: parsed.data.middleName,
          nickname: parsed.data.nickname,
          phone: parsed.data.phone,
          birthDate: passportParsed.data.birthDate,
        },
      });
      await tx.instructorProfile.update({
        where: { userId: input.userId },
        data: {
          bio: parsed.data.bio,
          hourlyRate: parsed.data.hourlyRate,
          specializations,
          achievements,
          taxStatus: parsed.data.taxStatus,
          inn: parsed.data.inn,
          passportSeries: passportParsed.data.passportSeries,
          passportNumber: passportParsed.data.passportNumber,
          passportIssuedAt: passportParsed.data.passportIssuedAt,
          passportDepartmentCode: passportParsed.data.passportDepartmentCode,
          profileDraft: profileDraft as Prisma.InputJsonValue,
          verificationStatus: "PENDING",
          profileDraftRejectNote: null,
          profileDraftRejectedAt: null,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Этот номер телефона уже используется", status: 409 };
    }
    throw e;
  }

  const scan = input.passportScan;
  if (scan instanceof File && scan.size > 0) {
    if (!PASSPORT_UPLOAD_ALLOWED.has(scan.type)) {
      return { ok: false, error: "Паспорт: JPEG, PNG, WebP или PDF", status: 400 };
    }
    if (scan.size > PASSPORT_UPLOAD_MAX_BYTES) {
      return { ok: false, error: "Файл паспорта: максимум 8 MB", status: 400 };
    }
    const buffer = Buffer.from(await scan.arrayBuffer());
    if (!validateUploadedBytes(scan.type, buffer)) {
      return { ok: false, error: "Содержимое файла паспорта не соответствует формату", status: 400 };
    }
    const ext = passportFileExt(scan.type);
    const filename = `${input.userId}-PASSPORT-${randomUUID()}.${ext}`;
    const fileUrl = await writePrivateUpload("compliance", filename, buffer);
    await prisma.instructorComplianceDocument.create({
      data: {
        userId: input.userId,
        type: "PASSPORT",
        fileUrl,
        status: "PENDING",
      },
    });
  }

  const taxScan = input.taxDocumentScan;
  if (taxScan instanceof File && taxScan.size > 0) {
    if (!PASSPORT_UPLOAD_ALLOWED.has(taxScan.type)) {
      return { ok: false, error: "Документ НПД/ИП: JPEG, PNG, WebP или PDF", status: 400 };
    }
    if (taxScan.size > PASSPORT_UPLOAD_MAX_BYTES) {
      return { ok: false, error: "Файл НПД/ИП: максимум 8 MB", status: 400 };
    }
    const buffer = Buffer.from(await taxScan.arrayBuffer());
    if (!validateUploadedBytes(taxScan.type, buffer)) {
      return { ok: false, error: "Содержимое файла НПД/ИП не соответствует формату", status: 400 };
    }
    const taxType = parsed.data.taxStatus === "IP" ? ("TAX_STATUS_IP" as const) : ("TAX_STATUS_NPD" as const);
    const ext = passportFileExt(taxScan.type);
    const filename = `${input.userId}-${taxType}-${randomUUID()}.${ext}`;
    const fileUrl = await writePrivateUpload("compliance", filename, buffer);
    await prisma.instructorComplianceDocument.create({
      data: {
        userId: input.userId,
        type: taxType,
        fileUrl,
        status: "PENDING",
      },
    });
  } else {
    const existingTax = await prisma.instructorComplianceDocument.findFirst({
      where: { userId: input.userId, type: { in: ["TAX_STATUS_NPD", "TAX_STATUS_IP"] } },
      select: { id: true },
    });
    if (!existingTax) {
      return {
        ok: false,
        error: "Прикрепите документ НПД («Мой налог») или выписку ЕГРИП",
        status: 400,
      };
    }
  }

  try {
    const { emitAdminModerationProfileAlert } = await import("@/lib/services/admin-alerts");
    await emitAdminModerationProfileAlert({
      userId: input.userId,
      displayName: systemName || "Инструктор",
      kind: "NEW_ACCOUNT",
    });
  } catch (e) {
    console.error("[admin-alert] application edit", e instanceof Error ? e.message : e);
  }

  return { ok: true };
}
