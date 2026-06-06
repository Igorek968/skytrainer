"use client";

import type { UserRole } from "@prisma/client";

import {
  adminDeleteUserConfirmMessage,
  useAdminDeleteUserMutation,
} from "@/features/admin/use-admin-delete-user";
import { Button } from "@/shared/ui/button";

type Props = {
  userId: string;
  email: string;
  name: string | null;
  role: UserRole;
  size?: "sm" | "default";
  className?: string;
  disabled?: boolean;
};

export function AdminDeleteUserButton({
  userId,
  email,
  name,
  role,
  size = "sm",
  className,
  disabled,
}: Props) {
  const del = useAdminDeleteUserMutation();

  if (role === "ADMIN") {
    return null;
  }

  const handleClick = () => {
    if (!confirm(adminDeleteUserConfirmMessage({ email, name, role }))) return;
    del.mutate(userId);
  };

  return (
    <Button
      type="button"
      variant="destructive"
      size={size}
      className={className ?? "h-7 text-xs"}
      disabled={disabled || del.isPending}
      onClick={handleClick}
    >
      Удалить
    </Button>
  );
}
