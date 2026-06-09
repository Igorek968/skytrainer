import { NextResponse } from "next/server";

import {
  fetchAgencyCertificateData,
  renderAgencyCertificateHtml,
} from "@/lib/instructor-agency-registry";
import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { userId } = await ctx.params;
  const data = await fetchAgencyCertificateData(userId);
  if (!data) {
    return NextResponse.json({ error: "Инструктор не найден" }, { status: 404 });
  }

  const html = renderAgencyCertificateHtml(data);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
