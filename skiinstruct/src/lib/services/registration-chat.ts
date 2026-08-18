import { prisma } from "@/lib/prisma";
import { canRevealRegistrationContact } from "@/lib/services/paid-contact";

export async function assertRegistrationChatAccess(input: {
  registrationId: string;
  userId: string;
  role: string;
}) {
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: input.registrationId },
    select: {
      id: true,
      status: true,
      amountRub: true,
      clientId: true,
      event: { select: { instructorId: true, title: true } },
      client: { select: { name: true } },
    },
  });
  if (!reg) return { ok: false as const, status: 404 as const, error: "Not found" };

  const isClient = reg.clientId === input.userId;
  const isInstructor = reg.event.instructorId === input.userId;
  if (!isClient && !isInstructor && input.role !== "ADMIN" && input.role !== "MODERATOR") {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  if (!canRevealRegistrationContact(reg.status, Number(reg.amountRub)) && input.role !== "ADMIN" && input.role !== "MODERATOR") {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Чат доступен после записи на событие",
    };
  }

  return {
    ok: true as const,
    reg,
    isClient,
    isInstructor,
  };
}
