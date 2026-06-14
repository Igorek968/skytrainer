import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

import { buildInstructorProfileCreateData } from "@/lib/instructor-profile-defaults";
import { AGENCY_OFFER_VERSION } from "@/lib/legal-config";
import { prisma } from "@/lib/prisma";
import { canonicalizeActivityLabel, canonicalizeActivityLabels } from "@/lib/services/instructor-match";
import { findDuplicateParticipantByDisplayName } from "@/lib/services/user-display-name-uniqueness";
import { DISPLAY_NAME_DUPLICATE_MESSAGE, parseFullNameToParts } from "@/lib/user-display-name";

const applySchema = z.object({
  email: z.string().trim().email("Некорректный email").max(254).transform((s) => s.toLowerCase()),
  password: z.string().min(8, "Пароль: не меньше 8 символов").max(128),
  name: z.string().trim().min(2, "Укажите имя").max(120),
  bio: z.string().trim().min(20, "Кратко опишите опыт (от 20 символов)").max(4000),
  hourlyRate: z.coerce.number().min(500, "Минимальная ставка 500 ₽/ч").max(500_000),
  primarySpecialization: z.string().trim().min(1, "Выберите направление"),
  achievementsRaw: z.string().trim().max(2000).optional(),
});

export type CreateInstructorApplicationResult =
  | { ok: true; email: string }
  | { ok: false; error: string; status: 400 | 409 };

export async function createInstructorApplication(input: {
  email: string;
  password: string;
  passwordConfirm?: string;
  name: string;
  bio: string;
  hourlyRate: number;
  primarySpecialization: string;
  extraSpecializations?: string[];
  achievementsRaw?: string;
  acceptAgencyOffer?: boolean;
  acceptPrivacy?: boolean;
  taxStatus?: "SELF_EMPLOYED" | "IP";
  inn?: string;
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
    name: input.name,
    bio: input.bio,
    hourlyRate: input.hourlyRate,
    primarySpecialization: input.primarySpecialization,
    achievementsRaw: input.achievementsRaw,
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      flat.fieldErrors.email?.[0] ??
      flat.fieldErrors.password?.[0] ??
      flat.fieldErrors.name?.[0] ??
      flat.fieldErrors.bio?.[0] ??
      flat.fieldErrors.hourlyRate?.[0] ??
      flat.fieldErrors.primarySpecialization?.[0] ??
      "Проверьте поля формы";
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

  const { email, password, name, bio, hourlyRate } = parsed.data;

  const { firstName, lastName } = parseFullNameToParts(name);
  if (firstName && lastName) {
    const duplicateName = await findDuplicateParticipantByDisplayName(null, firstName, lastName);
    if (duplicateName) {
      return { ok: false, error: DISPLAY_NAME_DUPLICATE_MESSAGE, status: 409 };
    }
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

  const passwordHash = await hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "INSTRUCTOR",
        instructorProfile: {
          create: buildInstructorProfileCreateData({
            bio,
            hourlyRate,
            specializations,
            achievements,
            agencyOfferAcceptedAt: new Date(),
            agencyOfferVersion: AGENCY_OFFER_VERSION,
            taxStatus: input.taxStatus ?? null,
            inn: input.inn?.trim() || null,
          }),
        },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Этот email уже зарегистрирован", status: 409 };
    }
    throw e;
  }

  return { ok: true, email };
}
