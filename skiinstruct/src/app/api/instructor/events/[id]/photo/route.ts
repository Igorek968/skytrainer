import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { canEditInstructorEvent, serializeInstructorEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const UPLOAD_PREFIX = "/uploads/events/";

type Ctx = { params: Promise<{ id: string }> };

function isEventPhotoUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && url.startsWith(UPLOAD_PREFIX);
}

async function removeEventPhotoFile(photoUrl: string | null | undefined) {
  if (!isEventPhotoUrl(photoUrl)) return;
  const filepath = path.join(process.cwd(), "public", photoUrl.replace(/^\//, ""));
  try {
    await unlink(filepath);
  } catch {
    /* file may already be gone */
  }
}

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
  if (!canEditInstructorEvent(existing)) {
    return NextResponse.json(
      { error: "Фото можно изменить только в черновике или после отклонения модерации" },
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

  const dir = path.join(process.cwd(), "public", "uploads", "events");
  await mkdir(dir, { recursive: true });
  const filepath = path.join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const photoUrl = `${UPLOAD_PREFIX}${filename}`;
  await removeEventPhotoFile(existing.photoUrl);

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
  if (!canEditInstructorEvent(existing)) {
    return NextResponse.json(
      { error: "Фото можно удалить только в черновике или после отклонения модерации" },
      { status: 400 },
    );
  }

  await removeEventPhotoFile(existing.photoUrl);

  const row = await prisma.instructorEvent.update({
    where: { id },
    data: { photoUrl: null },
  });

  return NextResponse.json({ event: serializeInstructorEvent(row), ok: true });
}
