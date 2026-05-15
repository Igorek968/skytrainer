import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { normalizeRussianPhone } from "@/lib/phone";

const credentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
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
    email: { label: "Email", type: "text" },
    password: { label: "Пароль", type: "password" },
  },
  authorize: async (raw: Record<string, unknown> | undefined) => {
    const normalized = {
      email: typeof raw?.email === "string" ? raw.email.trim() : "",
      password: typeof raw?.password === "string" ? raw.password : "",
    };
    const parsed = credentialsSchema.safeParse(normalized);
    if (!parsed.success) return null;
    const { email: identifier, password } = parsed.data;

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
  callbacks: {
    ...authConfig.callbacks,
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
