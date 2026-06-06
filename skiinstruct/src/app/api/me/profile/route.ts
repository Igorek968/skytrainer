import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { clientSafeErrorMessage, isPrismaSchemaMismatch, prismaSchemaMismatchMessage } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

/** Частичное обновление: пустой `name` в теле не передавайте — иначе не трогаем поле в БД. */
const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите Ф.И.О.").max(200),
    birthDate: z.union([
      z.literal(""),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Формат даты: ГГГГ-ММ-ДД"),
    ]),
  })
  .partial()
  .superRefine((val, ctx) => {
    if (val.name === undefined && val.birthDate === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Нет полей для обновления: укажите Ф.И.О. или дату рождения.",
      });
    }
  });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true, image: true, birthDate: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: isPrismaSchemaMismatch(e)
          ? prismaSchemaMismatchMessage()
          : clientSafeErrorMessage(e, "Не удалось загрузить профиль"),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const hint =
      parsed.error.issues[0]?.message ||
      flat.formErrors[0] ||
      Object.values(flat.fieldErrors).flat()[0] ||
      "Некорректные данные";
    return NextResponse.json({ error: hint, details: flat }, { status: 400 });
  }

  const { name, birthDate } = parsed.data;

  const data: { name?: string; birthDate?: Date | null } = {};
  if (name !== undefined) data.name = name;
  if (birthDate !== undefined) {
    data.birthDate = birthDate === "" ? null : new Date(`${birthDate}T12:00:00.000Z`);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Нет полей для обновления. Укажите Ф.И.О. или дату рождения." },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { name: true, email: true, phone: true, image: true, birthDate: true },
    });

    return NextResponse.json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: isPrismaSchemaMismatch(e)
          ? prismaSchemaMismatchMessage()
          : clientSafeErrorMessage(e, "Не удалось сохранить профиль"),
      },
      { status: 500 },
    );
  }
}
