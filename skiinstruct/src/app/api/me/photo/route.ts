import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { compressUploadedImageBytes } from "@/lib/image-compress";
import { writePublicUpload } from "@/lib/public-uploads";
import { validateUploadedBytes } from "@/lib/upload-validation";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const raw = Buffer.from(await file.arrayBuffer());
  if (!validateUploadedBytes(file.type, raw)) {
    return NextResponse.json({ error: "Содержимое файла не соответствует формату" }, { status: 400 });
  }

  const { buffer, ext } = await compressUploadedImageBytes(raw, file.type);
  const filename = `${session.user.id}-${randomUUID()}.${ext}`;
  const imageUrl = await writePublicUpload("users", filename, buffer);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: imageUrl },
  });

  return NextResponse.json({ image: imageUrl });
}
