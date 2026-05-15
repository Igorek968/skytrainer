import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_GALLERY = 5;
const patchSchema = z.object({
  photoGallery: z.array(z.string().min(1)).max(MAX_GALLERY).optional(),
  coverUrl: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const filename = `${session.user.id}-${randomUUID()}.${ext}`;

  const dir = path.join(process.cwd(), "public", "uploads", "instructors");
  await mkdir(dir, { recursive: true });
  const filepath = path.join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const photoUrl = `/uploads/instructors/${filename}`;
  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: session.user.id },
    select: { photoGallery: true, photoUrl: true },
  });
  const current = profile?.photoGallery ?? [];
  if (current.length >= MAX_GALLERY) {
    return NextResponse.json(
      { error: `Можно загрузить максимум ${MAX_GALLERY} фото` },
      { status: 400 }
    );
  }

  const nextGallery = [...current, photoUrl];
  const nextCover = profile?.photoUrl || photoUrl;

  await prisma.instructorProfile.update({
    where: { userId: session.user.id },
    data: {
      photoUrl: nextCover,
      photoGallery: nextGallery,
    },
  });

  return NextResponse.json({ photoUrl, photoGallery: nextGallery });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const removeUrl = url.searchParams.get("photoUrl");

  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: session.user.id },
    select: { photoGallery: true, photoUrl: true },
  });
  const current = profile?.photoGallery ?? [];

  const nextGallery = removeUrl ? current.filter((p) => p !== removeUrl) : [];
  const nextCover = nextGallery[0] ?? null;

  await prisma.instructorProfile.update({
    where: { userId: session.user.id },
    data: { photoUrl: nextCover, photoGallery: nextGallery },
  });

  return NextResponse.json({ ok: true, photoGallery: nextGallery, photoUrl: nextCover });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: session.user.id },
    select: { photoGallery: true, photoUrl: true },
  });
  const current = profile?.photoGallery ?? [];
  const nextGallery = parsed.data.photoGallery ?? current;

  // Ensure instructor can only reorder existing own photos.
  const sameSet =
    nextGallery.length === current.length &&
    nextGallery.every((p) => current.includes(p)) &&
    current.every((p) => nextGallery.includes(p));
  if (!sameSet && parsed.data.photoGallery) {
    return NextResponse.json({ error: "Некорректный список фото" }, { status: 400 });
  }

  let coverUrl = parsed.data.coverUrl ?? profile?.photoUrl ?? null;
  if (coverUrl && !nextGallery.includes(coverUrl)) {
    coverUrl = nextGallery[0] ?? null;
  }
  if (!coverUrl && nextGallery.length) {
    coverUrl = nextGallery[0];
  }

  const updated = await prisma.instructorProfile.update({
    where: { userId: session.user.id },
    data: {
      photoGallery: nextGallery,
      photoUrl: coverUrl,
    },
    select: { photoGallery: true, photoUrl: true },
  });

  return NextResponse.json({
    photoGallery: updated.photoGallery,
    photoUrl: updated.photoUrl,
  });
}
