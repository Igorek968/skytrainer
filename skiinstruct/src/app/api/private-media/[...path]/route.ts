import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { resolveUserRole } from "@/lib/api-session";
import { mimeForUploadPath } from "@/lib/public-uploads";
import { readSensitiveUpload } from "@/lib/private-uploads";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function canAccessSensitiveFile(
  segments: string[],
  userId: string,
  role: Awaited<ReturnType<typeof resolveUserRole>>,
): Promise<boolean> {
  const subdir = segments[0];
  const filename = segments[1];
  if (!subdir || !filename) return false;

  if (role === "ADMIN") return true;

  if (subdir === "compliance") {
    if (role !== "INSTRUCTOR") return false;
    const ownerPrefix = `${userId}-`;
    return filename.startsWith(ownerPrefix);
  }

  if (subdir === "npd-receipts") {
    const orderIdPrefix = filename.includes("_") ? filename.split("_")[0] : filename.split("-")[0];
    if (!orderIdPrefix) return false;
    const order = await prisma.order.findUnique({
      where: { id: orderIdPrefix },
      select: { clientId: true, instructorId: true },
    });
    if (!order) return false;
    if (role === "INSTRUCTOR" && order.instructorId === userId) return true;
    if (role === "CLIENT" && order.clientId === userId) return true;
    return false;
  }

  return false;
}

/** Защищённая раздача compliance / npd-receipts (не из public/). */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id?.trim();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveUserRole(userId, session?.user?.role);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { path: segments } = await ctx.params;
  if (!(await canAccessSensitiveFile(segments, userId, role))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await readSensitiveUpload(segments);
  if (!buffer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const joined = segments.join("/");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeForUploadPath(joined),
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
