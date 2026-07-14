import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

import { buildInstructorProfileCreateData } from "@/lib/instructor-profile-defaults";
import { AGENCY_OFFER_VERSION } from "@/lib/legal-config";
import { normalizeRussianPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { canonicalizeActivityLabel, canonicalizeActivityLabels } from "@/lib/services/instructor-match";
import { findDuplicateParticipantByDisplayName } from "@/lib/services/user-display-name-uniqueness";
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
  middleName: z
    .string()
    .trim()
    .max(80)
    .refine((s) => !s || /^[\p{L}\p{M}\s'-]+$/u.test(s), {
      message: "Отчество: только буквы, пробел, дефис или апостроф",
    })
    .optional()
    .transform((s) => (s && s.length > 0 ? s : null)),
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
    .regex(/^\d{10,12}$/, "Укажите ИНН (10 или 12 цифр) — без него заявка на модерацию не отправляется"),
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
}): Promise<CreateInstructorApplicationResult> {
  if (!input.acceptAgencyOffer || !input.acceptPrivacy) {
    return {
      ok: false,
      error: "Необходимо принять агентский договор и политику обработки персональных данных",
      status: 400,
    };
  }

  if (input.passwordConfirm !== undefined && input.password !== input.passwordConfirm) {
    return { ok: false, error: "Пароли не совпадают", status: 400 };
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
    middleName: middleName ?? undefined,
    nickname,
  };

  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: systemName,
        middleName,
        nickname,
        phone,
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
            }),
            profileDraft,
          },
        },
      },
    });
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

  return { ok: true, email };
}
