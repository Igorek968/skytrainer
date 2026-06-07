import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { consumePhoneOtpIfValid } from "@/lib/phone-otp";
import { normalizeRussianPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { bindReferralFromCookie, ensureUserReferralCode } from "@/lib/services/referral";

const credentialsSchema = z
  .object({
    email: z.string().min(1),
    password: z.string().optional(),
    otp: z.string().optional(),
  })
  .refine((d) => Boolean(d.password?.length || d.otp?.trim().length), {
    message: "password or otp required",
  });

async function findUserForCredentials(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) {
    return prisma.user.findFirst({
      where: { email: { equals: trimmed, mode: "insensitive" } },
    });
  }
  const digits = normalizeRussianPhone(trimmed);
  if (!digits) return null;
  return prisma.user.findUnique({ where: { phone: digits } });
}

const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email или телефон", type: "text" },
    password: { label: "Пароль", type: "password" },
    otp: { label: "Код из SMS", type: "text" },
  },
  authorize: async (raw: Record<string, unknown> | undefined) => {
    const normalized = {
      email: typeof raw?.email === "string" ? raw.email.trim() : "",
      password: typeof raw?.password === "string" ? raw.password : "",
      otp: typeof raw?.otp === "string" ? raw.otp.trim() : "",
    };
    const parsed = credentialsSchema.safeParse(normalized);
    if (!parsed.success) return null;
    const { email: identifier, password, otp } = parsed.data;

    const phoneNorm = normalizeRussianPhone(identifier);
    if (phoneNorm && otp) {
      if (!rateLimit(`phone-otp-verify:${phoneNorm}`, 12, 3_600_000)) {
        return null;
      }
      const otpResult = await consumePhoneOtpIfValid(phoneNorm, otp);
      if (!otpResult.ok) return null;

      let user = await prisma.user.findUnique({ where: { phone: phoneNorm } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            phone: phoneNorm,
            email: `phone+${phoneNorm}@clients.utrainer.local`,
            name: otpResult.pendingName,
            role: "CLIENT",
          },
        });
        await bindReferralFromCookie(user.id);
        void ensureUserReferralCode(user.id).catch(() => {});
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    }

    if (!password) return null;

    const loginKey = identifier.includes("@")
      ? identifier.trim().toLowerCase()
      : normalizeRussianPhone(identifier) ?? identifier.trim();
    if (!rateLimit(`login:${loginKey}`, 12, 900_000)) {
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
