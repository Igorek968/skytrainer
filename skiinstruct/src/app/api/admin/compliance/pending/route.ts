import { NextResponse } from "next/server";

import { fetchPendingComplianceDocuments } from "@/lib/instructor-agency-registry";
import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const items = await fetchPendingComplianceDocuments();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  });
}
