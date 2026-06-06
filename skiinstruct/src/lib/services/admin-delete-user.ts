import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminDeleteUserResult =
  | { ok: true; email: string; role: UserRole }
  | { ok: false; error: string; status: number };

export async function adminDeleteUser(params: {
  targetUserId: string;
  actorUserId: string;
}): Promise<AdminDeleteUserResult> {
  const targetId = params.targetUserId.trim();
  if (!targetId) {
    return { ok: false, error: "Не указан пользователь", status: 400 };
  }

  if (targetId === params.actorUserId) {
    return { ok: false, error: "Нельзя удалить свой аккаунт", status: 400 };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true },
  });

  if (!target) {
    return { ok: false, error: "Пользователь не найден", status: 404 };
  }

  if (target.role === "ADMIN") {
    return { ok: false, error: "Нельзя удалить учётную запись администратора", status: 403 };
  }

  await prisma.user.delete({ where: { id: target.id } });

  return { ok: true, email: target.email, role: target.role };
}
