"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

import type { InstructorRegistrationParticipant } from "@/lib/instructor-event-registration";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";

type RegRow = InstructorRegistrationParticipant & {
  canCancel: boolean;
  cancelReason: string | null;
  attendanceLabel: string;
  attendanceConfirmedAt: string | null;
  slotId: string | null;
  slotTime: string | null;
};

async function instructorFetch(input: RequestInfo, init?: RequestInit) {
  return fetch(input, { ...init, credentials: "include" });
}

function ClientAvatar({ name, image }: { name: string | null; image: string | null }) {
  const label = name?.trim() || "?";
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
      {label.slice(0, 1).toUpperCase()}
    </div>
  );
}

function RatingStars({ avg, count }: { avg: number | null; count: number }) {
  if (avg == null || count < 1) {
    return <span className="text-xs text-muted-foreground">Нет оценок</span>;
  }
  return (
    <span className="text-xs text-muted-foreground">
      ★ {avg.toFixed(1)} ({count})
    </span>
  );
}

export function EventRegistrantsPanel({
  eventId,
  compact,
}: {
  eventId: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["instructor-event-registrations", eventId],
    queryFn: async () => {
      const r = await instructorFetch(`/api/instructor/events/${eventId}/registrations`);
      if (!r.ok) throw new Error("registrations");
      return r.json() as Promise<{ registrations: RegRow[] }>;
    },
  });

  const cancelReg = useMutation({
    mutationFn: async (registrationId: string) => {
      const r = await instructorFetch(`/api/instructor/events/${eventId}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_registration", registrationId }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "cancel");
    },
    onSuccess: async () => {
      toast.success("Запись отменена");
      await qc.invalidateQueries({ queryKey: ["instructor-event-registrations", eventId] });
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
      await qc.invalidateQueries({ queryKey: ["instructor-registrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remindAll = useMutation({
    mutationFn: async () => {
      const r = await instructorFetch(`/api/instructor/events/${eventId}/attendance-reminders`, {
        method: "POST",
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "remind");
      return j;
    },
    onSuccess: async (j) => {
      toast.success(j.message ?? "Напоминания отправлены");
      await qc.invalidateQueries({ queryKey: ["instructor-event-registrations", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.registrations ?? [];
  const pendingConfirm = rows.filter((r) => !r.attendanceConfirmedAt && r.status !== "CANCELLED");

  const slotGroups = rows.reduce(
    (acc, reg) => {
      const key = reg.slotTime ?? "Без слота";
      if (!acc[key]) acc[key] = [];
      acc[key].push(reg);
      return acc;
    },
    {} as Record<string, RegRow[]>,
  );
  const groupKeys = Object.keys(slotGroups).sort((a, b) => {
    if (a === "Без слота") return 1;
    if (b === "Без слота") return -1;
    return a.localeCompare(b, "ru");
  });

  if (isLoading) {
    return <p className="mt-2 text-xs text-muted-foreground">Загрузка участников…</p>;
  }
  if (!rows.length) {
    return compact ? null : (
      <p className="mt-2 text-xs text-muted-foreground">Пока нет заявок на участие.</p>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border/80 bg-muted/30 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Участники ({rows.length})</p>
        {pendingConfirm.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={remindAll.isPending}
            onClick={() => remindAll.mutate()}
          >
            Напомнить ({pendingConfirm.length})
          </Button>
        ) : null}
      </div>
      <ul className="space-y-3">
        {groupKeys.map((slotLabel) => (
          <li key={slotLabel}>
            {groupKeys.length > 1 || slotLabel !== "Без слота" ? (
              <p className="mb-1.5 text-xs font-semibold text-foreground">
                {slotLabel === "Без слота" ? slotLabel : `Выход ${slotLabel}`}
                <span className="ml-1 font-normal text-muted-foreground">
                  ({slotGroups[slotLabel]!.length})
                </span>
              </p>
            ) : null}
            <ul className="space-y-2">
              {slotGroups[slotLabel]!.map((reg) => (
                <li
                  key={reg.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2"
                >
                  <ClientAvatar name={reg.client.name} image={reg.client.image} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {reg.client.name?.trim() || reg.client.email}
                    </div>
                    <RatingStars avg={reg.client.ratingAvg} count={reg.client.ratingCount} />
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge
                        variant={reg.attendanceConfirmedAt ? "secondary" : "outline"}
                        className="text-[10px] font-normal"
                      >
                        {reg.attendanceLabel}
                      </Badge>
                      {reg.amountRub > 0 ? (
                        <span className="text-[10px] text-muted-foreground">
                          {reg.amountRub.toLocaleString("ru-RU")} ₽
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Бесплатно</span>
                      )}
                    </div>
                  </div>
                  {!compact ? (
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/instructor/registrations/${reg.id}`}>Заявка</Link>
                      </Button>
                      {reg.canCancel ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={cancelReg.isPending}
                          onClick={() => {
                            if (!confirm("Отменить запись этого участника?")) return;
                            cancelReg.mutate(reg.id);
                          }}
                        >
                          Отменить
                        </Button>
                      ) : reg.cancelReason ? (
                        <span className="text-[10px] text-muted-foreground">{reg.cancelReason}</span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
