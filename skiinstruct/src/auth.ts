import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { validatePasswordResetToken } from "@/lib/services/password-reset";
import { consumeEmailLoginToken } from "@/lib/services/email-verification";
import { bindReferralFromCookie, ensureUserReferralCode } from "@/lib/services/referral";
import type { UserRole } from "@prisma/client";

const credentialsSchema = z
  .object({
    email: z.string().optional(),
    password: z.string().optional(),
    resetToken: z.string().optional(),
    emailLoginToken: z.string().optional(),
    captchaToken: z.string().optional(),
  })
  .refine(
    (d) =>
      Boolean(
        d.resetToken?.trim().length ||
          d.emailLoginToken?.trim().length ||
          d.password?.length,
      ),
    {
      message: "password, resetToken or emailLoginToken required",
    },
  );

async function findUserForCredentials(email: string) {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) return null;
  return prisma.user.findFirst({
    where: { email: { equals: trimmed, mode: "insensitive" } },
  });
}

const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "text" },
    password: { label: "Пароль", type: "password" },
    resetToken: { label: "Токен сброса пароля", type: "text" },
    emailLoginToken: { label: "Токен входа после email", type: "text" },
    captchaToken: { label: "Turnstile", type: "text" },
    /** Только Server Actions: значение = AUTH_SECRET (после уже проверенного captcha). */
    trustedServerSignIn: { label: "Trusted", type: "text" },
  },
  authorize: async (raw: Record<string, unknown> | undefined) => {
    const requestHeaders = await headers();
    const ip = clientIp(requestHeaders);
    const resetToken = typeof raw?.resetToken === "string" ? raw.resetToken.trim() : "";
    const emailLoginToken =
      typeof raw?.emailLoginToken === "string" ? raw.emailLoginToken.trim() : "";
    const captchaToken = typeof raw?.captchaToken === "string" ? raw.captchaToken.trim() : "";
    const trustedRaw =
      typeof raw?.trustedServerSignIn === "string" ? raw.trustedServerSignIn.trim() : "";
    const authSecret =
      process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
    const trustedServer =
      Boolean(authSecret) && Boolean(trustedRaw) && trustedRaw === authSecret;
    // Одноразовые токены из письма — сами по себе фактор входа; Turnstile не требуем.
    const oneTimeToken = Boolean(resetToken || emailLoginToken);

    // Браузерный вход по паролю — Turnstile обязателен (если секрет задан).
    // Server Action / письмо: trustedServerSignIn или one-time token.
    if (!trustedServer && !oneTimeToken) {
      const humanOk = await verifyTurnstileToken(captchaToken, ip);
      if (!humanOk) return null;
    }

    if (emailLoginToken) {
      if (!rateLimit(`email-login:${emailLoginToken.slice(0, 16)}`, 8, 900_000)) {
        return null;
      }
      const login = await consumeEmailLoginToken(emailLoginToken);
      if (!login.ok) return null;
      const user = await prisma.user.findUnique({
        where: { id: login.userId },
        select: { id: true, email: true, name: true, image: true, role: true },
      });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    }

    if (resetToken) {
      if (!rateLimit(`password-reset:signin:${resetToken.slice(0, 16)}`, 8, 900_000)) {
        return null;
      }
      const reset = await validatePasswordResetToken(resetToken);
      if (!reset.ok) return null;
      const user = reset.user;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    }

    const normalized = {
      email: typeof raw?.email === "string" ? raw.email.trim() : "",
      password: typeof raw?.password === "string" ? raw.password : "",
      resetToken: "",
      emailLoginToken: "",
      captchaToken,
    };
    const parsed = credentialsSchema.safeParse(normalized);
    if (!parsed.success) return null;
    const { email: identifier, password } = parsed.data;
    if (!identifier || !password) return null;

    const loginKey = identifier.trim().toLowerCase();
    if (!rateLimit(`login-ip:${ip}`, 30, 900_000) || !rateLimit(`login:${loginKey}`, 12, 900_000)) {
      return null;
    }

    const user = await findUserForCredentials(identifier);
    if (!user?.passwordHash) return null;
    const ok = await compare(password, user.passwordHash);
    if (!ok) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [credentialsProvider, ...authConfig.providers],
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await bindReferralFromCookie(user.id);
      void ensureUserReferralCode(user.id).catch(() => {});
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.user.findFirst({
          where: { email: { equals: user.email, mode: "insensitive" } },
          select: { role: true },
        });
        if (existing && existing.role !== "CLIENT") {
          return false;
        }
      }
      return true;
    },
    async jwt(ctx: Parameters<NonNullable<typeof authConfig.callbacks.jwt>>[0]) {
      const token = await authConfig.callbacks.jwt(ctx);
      if (ctx.trigger === "update" && ctx.session && typeof ctx.session === "object") {
        const s = ctx.session as { email?: string; role?: string };
        if (typeof s.email === "string" && s.email.trim()) {
          token.email = s.email.trim().toLowerCase();
        }
      }
      const uid = token.sub ?? (ctx.user as { id?: string } | undefined)?.id;
      if (uid) {
        try {
          const db = await prisma.user.findUnique({
            where: { id: uid },
            select: { role: true, email: true },
          });
          if (db) {
            token.role = db.role;
            token.email = db.email;
          }
        } catch {
          /* оставляем token от authorize */
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as UserRole;
        if (typeof token.email === "string" && token.email.trim()) {
          session.user.email = token.email;
        }
      }
      return session;
    },
  },
});
