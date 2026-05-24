"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

import type { InstructorRegistrationParticipant } from "@/lib/instructor-event-registration";
import { registrationStatusLabel } from "@/lib/instructor-events";
import { Button } from "@/shared/ui/button";

type RegRow = InstructorRegistrationParticipant & {
  canCancel: boolean;
  cancelReason: string | null;
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

export function EventRegistrantsPanel({ eventId }: { eventId: string }) {
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

  const rows = data?.registrations ?? [];
  if (isLoading) {
    return <p className="mt-2 text-xs text-muted-foreground">Загрузка участников…</p>;
  }
  if (!rows.length) return null;

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border/80 bg-muted/30 p-2">
      <p className="text-xs font-medium text-foreground">Участники ({rows.length})</p>
      <ul className="space-y-2">
        {rows.map((reg) => (
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
              <div className="text-[10px] text-muted-foreground">
                {registrationStatusLabel(reg.status)}
                {reg.amountRub > 0 ? ` · ${reg.amountRub.toLocaleString("ru-RU")} ₽` : " · Бесплатно"}
              </div>
            </div>
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
          </li>
        ))}
      </ul>
    </div>
  );
}
