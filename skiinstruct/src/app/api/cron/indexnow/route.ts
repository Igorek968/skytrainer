import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/lib/cron-auth";
import { indexNowPublicUrls, submitIndexNow } from "@/lib/indexnow";

async function runIndexNow() {
  const urls = indexNowPublicUrls();
  const result = await submitIndexNow(urls);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

/** Vercel Cron / планировщик: GET с Bearer CRON_SECRET — уведомить Яндекс (IndexNow). */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runIndexNow();
}

export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runIndexNow();
}
