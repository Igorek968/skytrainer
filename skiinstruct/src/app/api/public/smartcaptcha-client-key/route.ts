import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Публичный клиентский ключ SmartCaptcha (не секрет) — для SPA, если не вшит в бандл. */
export async function GET() {
  const clientKey = process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY?.trim() || "";
  return NextResponse.json(
    { clientKey },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
