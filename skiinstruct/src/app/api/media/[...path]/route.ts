import { NextResponse } from "next/server";

import { mimeForUploadPath, readPublicUpload } from "@/lib/public-uploads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

/** Раздача публичных файлов из public/uploads (без compliance / npd-receipts). */
export async function GET(_req: Request, ctx: Ctx) {
  const { path: segments } = await ctx.params;
  const subdir = segments[0];
  if (subdir === "compliance" || subdir === "npd-receipts") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const buffer = await readPublicUpload(segments);
  if (!buffer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const joined = segments.join("/");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeForUploadPath(joined),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
