import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import {
  buildYookassaPackageFiles,
  buildYookassaPackageHtml,
} from "@/lib/yookassa-document-package";
import { buildZipStore } from "@/lib/zip-store";

export const dynamic = "force-dynamic";

/** Пакет документов для ЮKassa: html | zip | preview | manifest */
export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("activeOnly") === "1";
  const noCertificates = url.searchParams.get("noCertificates") === "1";
  const noClientCertificates = url.searchParams.get("noClientCertificates") === "1";
  const allClients = url.searchParams.get("allClients") === "1";
  const format = url.searchParams.get("format") ?? "html";
  const stamp = new Date().toISOString().slice(0, 10);

  const options = {
    activeOnly,
    includeCertificates: !noCertificates,
    includeClientCertificates: !noClientCertificates,
    allClients,
  };

  if (format === "manifest") {
    const pkg = await buildYookassaPackageFiles(options);
    return NextResponse.json({
      generatedAt: pkg.generatedAt,
      rowCount: pkg.rowCount,
      files: pkg.files.map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        bytes: Buffer.byteLength(f.content, "utf8"),
      })),
    });
  }

  if (format === "zip") {
    const pkg = await buildYookassaPackageFiles(options);
    const zip = buildZipStore(pkg.files.map((f) => ({ name: f.name, content: f.content })));
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="yookassa-paket-${stamp}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const html = await buildYookassaPackageHtml(options);

  if (format === "preview") {
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="yookassa-paket-${stamp}.html"`,
      "Cache-Control": "no-store",
    },
  });
}
