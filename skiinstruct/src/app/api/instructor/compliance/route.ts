import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { getInstructorComplianceStatus } from "@/lib/instructor-compliance";
import { normalizeRussianPhone } from "@/lib/phone";
import { writePrivateUpload } from "@/lib/private-uploads";
import { prisma } from "@/lib/prisma";
import { validateUploadedBytes } from "@/lib/upload-validation";

const MAX_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const patchSchema = z.object({
  taxStatus: z.enum(["SELF_EMPLOYED", "IP"]).optional(),
  inn: z.string().regex(/^\d{10,12}$/, "Укажите ИНН (10 или 12 цифр)").optional(),
  payoutAccountHint: z.string().min(4).max(64).optional(),
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
    })
    .optional(),
});

export async function GET() {
  const auth = await requireInstructorSession();
  if (isApiErrorResponse(auth)) return auth;
  const status = await getInstructorComplianceStatus(auth.userId);
  return NextResponse.json(status);
}

export async function PATCH(req: Request) {
  const auth = await requireInstructorSession();
  if (isApiErrorResponse(auth)) return auth;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      flat.fieldErrors.inn?.[0] ??
      flat.fieldErrors.phone?.[0] ??
      flat.fieldErrors.payoutAccountHint?.[0] ??
      flat.fieldErrors.taxStatus?.[0] ??
      "Проверьте поля";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { phone, ...profileData } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(profileData).length > 0) {
        await tx.instructorProfile.update({
          where: { userId: auth.userId },
          data: profileData,
        });
      }
      if (phone !== undefined) {
        await tx.user.update({
          where: { id: auth.userId },
          data: { phone },
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Этот номер телефона уже используется" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json(await getInstructorComplianceStatus(auth.userId));
}

export async function POST(req: Request) {
  const auth = await requireInstructorSession();
  if (isApiErrorResponse(auth)) return auth;

  const form = await req.formData();
  const file = form.get("file");
  const typeRaw = String(form.get("type") ?? "");
  const type =
    typeRaw === "INSURANCE" || typeRaw === "TAX_STATUS_NPD" || typeRaw === "TAX_STATUS_IP"
      ? typeRaw
      : null;

  if (!(file instanceof File) || !type) {
    return NextResponse.json({ error: "Передайте file и type" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Допустимы JPG, PNG, WEBP, PDF" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Максимум 8 MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateUploadedBytes(file.type, buffer)) {
    return NextResponse.json({ error: "Содержимое файла не соответствует формату" }, { status: 400 });
  }

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const filename = `${auth.userId}-${type}-${randomUUID()}.${ext}`;
  const fileUrl = await writePrivateUpload("compliance", filename, buffer);

  const doc = await prisma.instructorComplianceDocument.create({
    data: {
      userId: auth.userId,
      type,
      fileUrl,
      status: "PENDING",
    },
  });

  try {
    const { emitAdminComplianceAlert } = await import("@/lib/services/admin-alerts");
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, email: true },
    });
    await emitAdminComplianceAlert({
      documentId: doc.id,
      userId: auth.userId,
      userLabel: user?.name?.trim() || user?.email || auth.userId,
      docType: type,
    });
  } catch (e) {
    console.error("[admin-alert] compliance", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ document: doc });
}
