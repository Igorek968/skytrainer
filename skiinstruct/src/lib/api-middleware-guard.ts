import type { Session } from "next-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { assertMutationSameOrigin } from "@/lib/mutating-request-guard";

const ORIGIN_EXEMPT_PREFIXES = [
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/api/health",
] as const;

const PUBLIC_API_PREFIXES = [
  "/api/geocode",
  "/api/instructors",
  "/api/resorts",
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/api/health",
  "/api/media",
  "/api/support",
] as const;

function isPublicApiPath(pathname: string): boolean {
  if (pathname === "/api/client/events") return true;
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isOriginExempt(pathname: string): boolean {
  return ORIGIN_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function guardApiRequest(
  req: NextRequest,
  session: Session | null | undefined,
): NextResponse | null {
  const pathname = req.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (!pathname.startsWith("/api")) return null;

  if (!isOriginExempt(pathname)) {
    const originBlock = assertMutationSameOrigin(req);
    if (originBlock) return originBlock;
  }

  const role = session?.user?.role as UserRole | undefined;

  if (pathname.startsWith("/api/admin")) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }

  if (pathname.startsWith("/api/instructor")) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }

  const clientOnlyPrefixes = [
    "/api/client/registrations",
    "/api/client/favorites",
    "/api/client/conversations",
    "/api/payments",
    "/api/stripe",
  ];
  if (clientOnlyPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }

  if (pathname.match(/^\/api\/client\/events\/[^/]+\/register$/)) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }

  if (pathname.startsWith("/api/private-media")) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }

  if (!isPublicApiPath(pathname) && pathname.startsWith("/api/me")) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return null;
}
