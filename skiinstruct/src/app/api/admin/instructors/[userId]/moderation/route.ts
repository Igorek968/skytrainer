import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { fetchInstructorModerationDossier } from "@/lib/instructor-moderation-dossier";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { userId } = await ctx.params;
  const dossier = await fetchInstructorModerationDossier(userId);
  if (!dossier) {
    return NextResponse.json({ error: "Инструктор не найден" }, { status: 404 });
  }
  return NextResponse.json(dossier, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
