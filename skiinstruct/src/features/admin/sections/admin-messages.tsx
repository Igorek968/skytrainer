"use client";

import { useQuery } from "@tanstack/react-query";
import type { UserRole } from "@prisma/client";

import { ADMIN_USER_ROLE_LABELS, type AdminUserRoleFilter } from "@/lib/admin-list-filters";
import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { devPollInterval } from "@/lib/query-poll";

type AdminMessageRow = {
  id: string;
  subject: string | null;
  body: string;
  emailSent: boolean;
  emailSentAt: string | null;
  createdAt: string;
  sender: { id: string; email: string; name: string | null };
  recipient: { id: string; email: string; name: string | null; role: UserRole };
};

function formatWhen(iso: string): string {
  try {
    return formatInAppTimeZone(iso);
  } catch {
    return iso;
  }
}

function roleLabel(role: string): string {
  return ADMIN_USER_ROLE_LABELS[role as AdminUserRoleFilter] ?? role;
}

export function AdminMessagesSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-direct-messages"],
    queryFn: async () => {
      const r = await fetch("/api/admin/messages", {
        credentials: "include",
        cache: "no-store",
      });
      if (r.status === 403) throw new Error("forbidden");
      if (!r.ok) throw new Error(`messages-${r.status}`);
      return r.json() as Promise<{ messages: AdminMessageRow[] }>;
    },
    staleTime: 10_000,
    refetchInterval: devPollInterval(20_000),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Исходящие сообщения</CardTitle>
        <CardDescription>
          Последние сообщения администраторов пользователям. Каждое дублируется на email адресата.
          Новое сообщение — из списка «Пользователи» → «Написать».
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Не удалось загрузить историю.</p>
        ) : !data?.messages.length ? (
          <p className="text-sm text-muted-foreground">Пока нет отправленных сообщений.</p>
        ) : (
          <ul className="space-y-3">
            {data.messages.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-border/80 bg-muted/20 px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {m.recipient.name?.trim() || m.recipient.email}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.recipient.email}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {roleLabel(m.recipient.role)}
                  </Badge>
                  {m.emailSent ? (
                    <Badge variant="default" className="text-[10px]">
                      Email отправлен
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      Email не ушёл
                    </Badge>
                  )}
                </div>
                {m.subject ? (
                  <p className="mt-1 text-sm font-medium text-foreground">{m.subject}</p>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{m.body}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatWhen(m.createdAt)}
                  {m.sender.name?.trim() || m.sender.email
                    ? ` · от ${m.sender.name?.trim() || m.sender.email}`
                    : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
