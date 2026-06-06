"use client";

import type { UserRole } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type DeleteUserResult = {
  ok: boolean;
  email: string;
  role: UserRole;
};

export function adminDeleteUserConfirmMessage(input: {
  email: string;
  name: string | null;
  role: UserRole;
}): string {
  const who = input.name?.trim() ? `${input.name.trim()} (${input.email})` : input.email;

  if (input.role === "INSTRUCTOR") {
    return (
      `Удалить аккаунт инструктора ${who}?\n\n` +
      "Анкета, мероприятия и заявки на выплату будут удалены безвозвратно. " +
      "Заказы сохранятся, связь с инструктором будет сброшена."
    );
  }

  return (
    `Удалить аккаунт клиента ${who}?\n\n` +
    "Заказы этого клиента, записи на мероприятия и переписка по заказам будут удалены безвозвратно."
  );
}

export function useAdminDeleteUserMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Не удалось удалить пользователя");
      }
      return j as DeleteUserResult;
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["admin-users-list"], exact: false });
      await qc.invalidateQueries({ queryKey: ["admin-overview"], exact: false });
      toast.success(`Аккаунт ${data.email} удалён`);
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка"),
  });
}
