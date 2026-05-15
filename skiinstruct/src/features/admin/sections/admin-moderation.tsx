"use client";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { useAdminVerifyInstructorMutation } from "@/features/admin/use-admin-overview";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function AdminModerationSection({ data }: { data: AdminOverview }) {
  const verify = useAdminVerifyInstructorMutation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Модерация сертификатов</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.pendingList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Очередь пуста</p>
        ) : (
          <ul className="space-y-3">
            {data.pendingList.map((p) => (
              <li
                key={p.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div>
                  <div className="font-medium">{p.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                  <div className="text-xs">{p.certificationLevel}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="accent"
                    disabled={verify.isPending}
                    onClick={() => verify.mutate({ userId: p.userId, status: "APPROVED" })}
                  >
                    Одобрить
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={verify.isPending}
                    onClick={() => verify.mutate({ userId: p.userId, status: "REJECTED" })}
                  >
                    Отклонить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
