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
import { bindReferralFromCookie, ensureUserReferralCode } from "@/lib/services/referral";

const credentialsSchema = z
  .object({
    email: z.string().optional(),
    password: z.string().optional(),
    resetToken: z.string().optional(),
    captchaToken: z.string().optional(),
  })
  .refine((d) => Boolean(d.resetToken?.trim().length || d.password?.length), {
    message: "password or resetToken required",
  });

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
  },
  authorize: async (raw: Record<string, unknown> | undefined) => {
    const requestHeaders = await headers();
    const ip = clientIp(requestHeaders);
    const resetToken = typeof raw?.resetToken === "string" ? raw.resetToken.trim() : "";
    const captchaToken = typeof raw?.captchaToken === "string" ? raw.captchaToken.trim() : "";
    const humanOk = await verifyTurnstileToken(captchaToken, ip);
    if (!humanOk) return null;

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
      const uid = token.sub ?? (ctx.user as { id?: string } | undefined)?.id;
      if (uid) {
        try {
          const db = await prisma.user.findUnique({
            where: { id: uid },
            select: { role: true },
          });
          if (db) {
            token.role = db.role;
          }
        } catch {
          /* оставляем token.role от authorize */
        }
      }
      return token;
    },
  },
});
