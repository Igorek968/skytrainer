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

const PLACEHOLDER_SECRETS = new Set([
  "replace-with-long-random-secret",
  "skiinstruct-local-dev-auth-secret-not-for-production",
]);

function resolveAuthSecret(): string | undefined {
  const fromEnv = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (fromEnv) {
    if (process.env.NODE_ENV === "production" && PLACEHOLDER_SECRETS.has(fromEnv)) {
      return undefined;
    }
    return fromEnv;
  }

  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  if (
    process.env.SKIINSTRUCT_AUTH_DEV_FALLBACK === "1" ||
    process.env.SKIINSTRUCT_AUTH_DEV_FALLBACK === "true" ||
    inferLocalSiteFromEnv()
  ) {
    return "skiinstruct-local-dev-auth-secret-not-for-production";
  }

  return "skiinstruct-local-dev-auth-secret-not-for-production";
}

function useSecureSessionCookies(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!url) return true;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return true;
  }
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
        allowDangerousEmailAccountLinking: false,
      }),
    ]
  : [];

export const authConfig = {
  secret: resolveAuthSecret(),
  trustHost: true,
  useSecureCookies: useSecureSessionCookies(),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureSessionCookies(),
      },
    },
  },
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
      // Не принимаем role из клиентского session.update — только из user/DB (см. auth.ts).
      if (trigger === "update" && session && typeof session === "object") {
        const patch = session as Record<string, unknown>;
        if ("name" in patch && typeof patch.name === "string") token.name = patch.name;
        if ("email" in patch && typeof patch.email === "string") token.email = patch.email;
        if ("image" in patch && (typeof patch.image === "string" || patch.image === null)) {
          token.picture = patch.image ?? undefined;
        }
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
