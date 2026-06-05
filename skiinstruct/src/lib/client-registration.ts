import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendEmailVerification } from "@/lib/services/email-verification";

const registerSchema = z.object({
  email: z.string().trim().email("Некорректный email").max(254).transform((s) => s.toLowerCase()),
  password: z.string().min(8, "Пароль: не меньше 8 символов").max(128),
});

export type CreateClientUserResult =
  | { ok: true; email: string }
  | { ok: false; error: string; status: 400 | 409 };

/**
 * Создание учётной записи клиента (роль CLIENT, пароль — bcrypt).
 * Для инструкторов/админов с тем же email вернёт 409.
 */
export async function createClientUser(input: {
  email: string;
  password: string;
  passwordConfirm?: string;
  name?: string | null;
}): Promise<CreateClientUserResult> {
  if (input.passwordConfirm !== undefined && input.password !== input.passwordConfirm) {
    return { ok: false, error: "Пароли не совпадают", status: 400 };
  }

  const parsed = registerSchema.safeParse({
    email: input.email,
    password: input.password,
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      flat.fieldErrors.email?.[0] ??
      flat.fieldErrors.password?.[0] ??
      "Проверьте email и пароль";
    return { ok: false, error: msg, status: 400 };
  }

  const { email, password } = parsed.data;
  const nameRaw = typeof input.name === "string" ? input.name.trim() : "";
  const name = nameRaw.length > 0 ? nameRaw.slice(0, 120) : null;

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "Этот email уже зарегистрирован", status: 409 };
  }

  const passwordHash = await hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
        role: "CLIENT",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Этот email уже зарегистрирован", status: 409 };
    }
    throw e;
  }

  void sendEmailVerification(email).catch((e) => {
    console.error("[register] email verification send failed", e);
  });

  return { ok: true, email };
}
