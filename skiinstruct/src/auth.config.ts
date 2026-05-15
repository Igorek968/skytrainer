import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import type { UserRole } from "@prisma/client";

/**
 * Без секрета Auth.js отвечает error=Configuration.
 * Секрет из env; иначе — только «локальные» запасные варианты (см. resolveAuthSecret).
 */
function inferLocalSiteFromEnv(): boolean {
  const raw = [process.env.AUTH_URL, process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_APP_URL].find(
    (s) => typeof s === "string" && s.trim().length > 0,
  );
  if (!raw) return false;
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".local") ||
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^10\.\d+\.\d+\.\d+$/.test(host)
    );
  } catch {
    return false;
  }
}

function resolveAuthSecret(): string | undefined {
  const fromEnv = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const allowInsecure =
    process.env.NODE_ENV !== "production" ||
    inferLocalSiteFromEnv() ||
    process.env.SKIINSTRUCT_AUTH_DEV_FALLBACK === "1" ||
    process.env.SKIINSTRUCT_AUTH_DEV_FALLBACK === "true";

  if (allowInsecure) {
    return "skiinstruct-local-dev-auth-secret-not-for-production";
  }
  return undefined;
}

/**
 * Конфиг без Prisma — его может импортировать middleware (Edge).
 * Полный вход с Credentials и adapter собирается в `auth.ts`.
 */
const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID?.length) && Boolean(process.env.AUTH_GOOGLE_SECRET?.length);

const googleProviders = googleConfigured
  ? [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID!,
        clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        allowDangerousEmailAccountLinking: true,
      }),
    ]
  : [];

export const authConfig = {
  secret: resolveAuthSecret(),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [...googleProviders],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (user && "role" in user && (user as { role?: UserRole }).role) {
        token.role = (user as { role: UserRole }).role;
      }
      if (trigger === "update" && session?.role) {
        token.role = session.role as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
