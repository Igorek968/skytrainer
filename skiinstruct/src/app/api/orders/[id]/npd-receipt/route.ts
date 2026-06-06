import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { NPD_RECEIPT_DEADLINE_HOURS } from "@/lib/legal-config";
import { writePrivateUpload } from "@/lib/private-uploads";
import { prisma } from "@/lib/prisma";
import { validateUploadedBytes } from "@/lib/upload-validation";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireInstructorSession();
  if (isApiErrorResponse(auth)) return auth;

  const { id } = await ctx.params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.instructorId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status !== "COMPLETED") {
    return NextResponse.json({ error: "Чек можно загрузить после завершения урока" }, { status: 400 });
  }
  if (order.lessonEndedAt) {
    const deadline =
      order.lessonEndedAt.getTime() + NPD_RECEIPT_DEADLINE_HOURS * 3600 * 1000;
    if (Date.now() > deadline) {
      return NextResponse.json(
        { error: `Срок загрузки чека (${NPD_RECEIPT_DEADLINE_HOURS} ч) истёк` },
        { status: 400 },
      );
    }
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Допустимы JPG, PNG, WEBP, PDF" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Максимум 5 MB" }, { status: 400 });
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
  const filename = `${id}_${randomUUID()}.${ext}`;
  const npdReceiptUrl = await writePrivateUpload("npd-receipts", filename, buffer);

  const updated = await prisma.order.update({
    where: { id },
    data: {
      npdReceiptUrl,
      npdReceiptUploadedAt: new Date(),
    },
  });

  return NextResponse.json({ order: updated });
}
