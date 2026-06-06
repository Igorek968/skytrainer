import { Prisma } from "@prisma/client";

const isProd = process.env.NODE_ENV === "production";

export function isPrismaSchemaMismatch(e: unknown): boolean {
  const raw = e instanceof Error ? e.message : String(e);
  return /birthDate|Unknown argument|column|does not exist|P2022|P2021/i.test(raw);
}

export function prismaSchemaMismatchMessage(): string {
  return "База данных не совпадает с версией приложения. Выполните: npm run db:push";
}

/** Сообщение для клиента: без stack/SQL/схемы Prisma в production. */
export function clientSafeErrorMessage(e: unknown, fallback: string): string {
  if (!isProd) {
    if (e instanceof Error) return e.message;
    return String(e);
  }
  if (isPrismaSchemaMismatch(e)) return prismaSchemaMismatchMessage();
  if (e instanceof Prisma.PrismaClientKnownRequestError) return fallback;
  if (e instanceof Error && e.name === "PrismaClientValidationError") {
    return "Некорректные данные запроса.";
  }
  return fallback;
}
