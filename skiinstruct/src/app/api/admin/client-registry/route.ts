import { NextResponse } from "next/server";

import {
  clientBookingRegistryToCsv,
  fetchClientBookingRegistryRows,
} from "@/lib/client-booking-registry";
import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const paidOnly = url.searchParams.get("paidOnly") === "1";
  const format = url.searchParams.get("format");

  const rows = await fetchClientBookingRegistryRows({ paidOnly });

  if (format === "csv") {
    const csv = clientBookingRegistryToCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="client-registry-${stamp}.csv"`,
      },
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: rows.length,
    rows,
  });
}
