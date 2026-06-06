import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { getInstructorComplianceStatus } from "@/lib/instructor-compliance";
import { writePrivateUpload } from "@/lib/private-uploads";
import { prisma } from "@/lib/prisma";
import { validateUploadedBytes } from "@/lib/upload-validation";

const MAX_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const patchSchema = z.object({
  taxStatus: z.enum(["SELF_EMPLOYED", "IP"]).optional(),
  inn: z.string().regex(/^\d{10,12}$/).optional(),
  payoutAccountHint: z.string().min(4).max(64).optional(),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.instructorProfile.update({
    where: { userId: auth.userId },
    data: parsed.data,
  });

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

  return NextResponse.json({ document: doc });
}
