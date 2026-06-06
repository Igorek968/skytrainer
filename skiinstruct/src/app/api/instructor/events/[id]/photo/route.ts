import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  canEditInstructorEventPhoto,
  serializeInstructorEvent,
} from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { removePublicUploadByUrl, writePublicUpload } from "@/lib/public-uploads";
import { validateUploadedBytes } from "@/lib/upload-validation";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id } = await ctx.params;

  const existing = await prisma.instructorEvent.findFirst({
    where: { id, instructorId: userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  }
  if (!canEditInstructorEventPhoto(existing)) {
    return NextResponse.json(
      { error: "Фото можно изменить только в черновике, после отклонения или у опубликованного мероприятия до даты проведения" },
      { status: 400 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Допустимы JPG, PNG, WEBP" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Максимум 5 MB" }, { status: 400 });
  }

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `${id}-${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateUploadedBytes(file.type, buffer)) {
    return NextResponse.json({ error: "Содержимое файла не соответствует формату" }, { status: 400 });
  }
  const photoUrl = await writePublicUpload("events", filename, buffer);
  await removePublicUploadByUrl(existing.photoUrl);

  const row = await prisma.instructorEvent.update({
    where: { id },
    data: { photoUrl },
  });

  return NextResponse.json({ event: serializeInstructorEvent(row), photoUrl });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id } = await ctx.params;

  const existing = await prisma.instructorEvent.findFirst({
    where: { id, instructorId: userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  }
  if (!canEditInstructorEventPhoto(existing)) {
    return NextResponse.json(
      { error: "Фото можно удалить только пока мероприятие не завершено" },
      { status: 400 },
    );
  }

  await removePublicUploadByUrl(existing.photoUrl);

  const row = await prisma.instructorEvent.update({
    where: { id },
    data: { photoUrl: null },
  });

  return NextResponse.json({ event: serializeInstructorEvent(row), ok: true });
}
