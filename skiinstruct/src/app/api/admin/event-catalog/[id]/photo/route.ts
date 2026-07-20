import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { serializeEventCatalogItem } from "@/lib/services/event-catalog-admin";
import { removePublicUploadByUrl, writePublicUpload } from "@/lib/public-uploads";
import { validateUploadedBytes } from "@/lib/upload-validation";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { id } = await ctx.params;
  const existing = await prisma.eventCatalogItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
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
  const filename = `catalog-${id}-${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateUploadedBytes(file.type, buffer)) {
    return NextResponse.json({ error: "Содержимое файла не соответствует формату" }, { status: 400 });
  }

  const photoUrl = await writePublicUpload("events", filename, buffer);
  await removePublicUploadByUrl(existing.photoUrl);

  const row = await prisma.eventCatalogItem.update({
    where: { id },
    data: { photoUrl },
    include: { events: { select: { id: true } } },
  });

  return NextResponse.json({
    item: serializeEventCatalogItem(row),
    photoUrl,
    message: "Фото карточки сохранено",
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { id } = await ctx.params;
  const existing = await prisma.eventCatalogItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
  }

  await removePublicUploadByUrl(existing.photoUrl);

  const row = await prisma.eventCatalogItem.update({
    where: { id },
    data: { photoUrl: null },
    include: { events: { select: { id: true } } },
  });

  return NextResponse.json({
    item: serializeEventCatalogItem(row),
    ok: true,
    message: "Фото удалено",
  });
}
