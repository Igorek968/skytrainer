"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import type { InstructorRegistrationParticipant } from "@/lib/instructor-event-registration";
import { formatEventPartyRu } from "@/lib/event-party";
import { ForceMajeureCancelButton } from "@/features/instructor/force-majeure-cancel-button";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";

type RegRow = InstructorRegistrationParticipant & {
  canCancel: boolean;
  cancelReason: string | null;
  attendanceLabel: string;
  attendanceConfirmedAt: string | null;
  slotId: string | null;
  slotTime: string | null;
  instructorRating: number | null;
  canReviewAttendee: boolean;
  adultCount: number;
  childCount: number;
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

function AttendeeReviewForm({
  eventId,
  registrationId,
}: {
  eventId: string;
  registrationId: string;
}) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

  const leave = useMutation({
    mutationFn: async () => {
      const r = await instructorFetch(`/api/instructor/events/${eventId}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_client_review",
          registrationId,
          rating,
          review,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось сохранить отзыв");
    },
    onSuccess: async () => {
      toast.success("Отзыв сохранён");
      await qc.invalidateQueries({ queryKey: ["instructor-event-registrations", eventId] });
      await qc.invalidateQueries({ queryKey: ["instructor-registration", registrationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-2 flex w-full flex-wrap items-center gap-1 border-t border-border pt-2">
      <Input
        type="number"
        min={1}
        max={5}
        className="h-8 w-14 text-xs"
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        aria-label="Оценка"
      />
      <Input
        className="h-8 min-w-[8rem] flex-1 text-xs"
        placeholder="Отзыв о участнике"
        value={review}
        onChange={(e) => setReview(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="accent"
        disabled={leave.isPending}
        onClick={() => leave.mutate()}
      >
        {leave.isPending ? "…" : "Оценить"}
      </Button>
    </div>
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
      return r.json() as Promise<{
        registrations: RegRow[];
        canForceMajeure?: boolean;
        forceMajeureReason?: string | null;
      }>;
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
      {data?.forceMajeureReason ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-100">
          Форс-мажор: {data.forceMajeureReason}
        </p>
      ) : null}
      <ForceMajeureCancelButton eventId={eventId} enabled={Boolean(data?.canForceMajeure)} />
      {!rows.length ? (
        compact ? null : (
          <p className="text-xs text-muted-foreground">Пока нет заявок на участие.</p>
        )
      ) : (
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
                      <p className="text-[11px] text-muted-foreground">{formatEventPartyRu(reg)}</p>
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
                    {!compact && reg.canReviewAttendee ? (
                      <AttendeeReviewForm eventId={eventId} registrationId={reg.id} />
                    ) : null}
                    {!compact && reg.instructorRating != null ? (
                      <p className="mt-1 w-full text-[10px] text-muted-foreground">
                        Ваша оценка: {reg.instructorRating}/5
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
