"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  instructorRegistrationStatusLabel,
  type InstructorRegistrationListItem,
} from "@/lib/instructor-event-registration";
import { formatEventDateRu, formatEventPriceRu } from "@/lib/instructor-events";
import { RegistrationChat } from "@/features/chat/registration-chat";
import { ForceMajeureCancelButton } from "@/features/instructor/force-majeure-cancel-button";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";

type RegistrationDetail = InstructorRegistrationListItem & {
  event: InstructorRegistrationListItem["event"] & {
    body: string;
    priceRub: number | null;
    maxRegistrations: number | null;
    moderationStatusLabel: string;
    isCompleted: boolean;
    canEdit: boolean;
    canRestoreArchived: boolean;
  };
  canCancelRegistration: boolean;
  cancelRegistrationReason: string | null;
  canRequestEventEdit: boolean;
  eventEditHint: string | null;
  canForceMajeure?: boolean;
  forceMajeureReason?: string | null;
  storedCancelReason?: string | null;
  attendanceConfirmedAt?: string | null;
  instructorRating?: number | null;
  instructorReview?: string | null;
  canReviewAttendee?: boolean;
};

function ClientAvatar({ name, image }: { name: string | null; image: string | null }) {
  const label = name?.trim() || "?";
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={56}
        height={56}
        className="h-14 w-14 rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-medium">
      {label.slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function InstructorRegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [clientRating, setClientRating] = useState(5);
  const [clientReview, setClientReview] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["instructor-registration", id],
    queryFn: async () => {
      const r = await fetch(`/api/instructor/registrations/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("registration");
      return r.json() as Promise<{ registration: RegistrationDetail }>;
    },
    enabled: Boolean(id),
  });

  const cancelReg = useMutation({
    mutationFn: async () => {
      const previewRes = await fetch(`/api/instructor/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "preview_cancel" }),
      });
      const preview = (await previewRes.json()) as {
        refundAmount?: number;
        refundPercent?: number;
        reason?: string;
        error?: string;
      };
      if (!previewRes.ok) throw new Error(preview.error ?? "preview");
      const msg =
        (preview.refundAmount ?? 0) > 0
          ? `Отменить запись?\n\n${preview.reason}\nК возврату: ${preview.refundAmount} ₽.`
          : `Отменить запись?\n\n${preview.reason}`;
      if (!confirm(msg)) return;

      const res = await fetch(`/api/instructor/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "cancel" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "cancel");
      return body;
    },
    onSuccess: async () => {
      toast.success("Запись отменена");
      await qc.invalidateQueries({ queryKey: ["instructor-registrations"] });
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      router.push("/instructor/orders");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestEdit = useMutation({
    mutationFn: async () => {
      if (
        !confirm(
          "Вернуть событие в черновик для правок? После изменений отправьте его на модерацию администратору.",
        )
      ) {
        return null;
      }
      const r = await fetch(`/api/instructor/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "request_event_edit" }),
      });
      const j = (await r.json()) as { error?: string; message?: string; eventId?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "edit");
      return j;
    },
    onSuccess: async (j) => {
      if (!j) return;
      toast.success(j.message ?? "Событие в черновиках");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
      router.push("/instructor#events");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewAttendee = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/instructor/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "add_client_review",
          rating: clientRating,
          review: clientReview,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось сохранить отзыв");
      return j;
    },
    onSuccess: async () => {
      toast.success("Отзыв о клиенте сохранён");
      await qc.invalidateQueries({ queryKey: ["instructor-registration", id] });
      await qc.invalidateQueries({ queryKey: ["instructor-event-registrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reg = data?.registration;

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" asChild>
        <Link href="/instructor/orders">← Заказы</Link>
      </Button>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : error || !reg ? (
        <p className="text-sm text-destructive">Заявка не найдена</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Запись на событие</CardTitle>
              <p className="text-sm text-muted-foreground">
                {instructorRegistrationStatusLabel(reg.status)} ·{" "}
                {reg.event.moderationStatusLabel}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <ClientAvatar name={reg.client.name} image={reg.client.image} />
                <div>
                  <div className="font-medium">{reg.client.name ?? reg.client.email}</div>
                  {reg.client.ratingAvg != null && reg.client.ratingCount > 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Рейтинг клиента: ★ {reg.client.ratingAvg.toFixed(1)} ({reg.client.ratingCount}{" "}
                      оценок)
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Пока нет ваших оценок клиенту</div>
                  )}
                  <div className="text-xs text-muted-foreground">{reg.client.email}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <h2 className="font-semibold">{reg.event.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reg.event.eventAt ? formatEventDateRu(reg.event.eventAt) : "Дата не указана"} ·{" "}
                  {formatEventPriceRu(reg.event.priceRub)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {reg.event.body}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Заявка от {new Date(reg.createdAt).toLocaleString("ru-RU")}
                {reg.paidAt ? ` · оплачено ${new Date(reg.paidAt).toLocaleString("ru-RU")}` : ""}
              </p>

              {reg.status === "PAID" || reg.status === "PENDING_PAYMENT" ? (
                <RegistrationChat
                  registrationId={reg.id}
                  contactUrl={`/api/instructor/registrations/${reg.id}/contact`}
                  callLabel="Позвонить клиенту"
                />
              ) : null}

              {reg.eventEditHint ? (
                <p className="text-xs text-muted-foreground">{reg.eventEditHint}</p>
              ) : null}

              {reg.storedCancelReason ? (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  Причина отмены: {reg.storedCancelReason}
                </p>
              ) : null}

              {reg.forceMajeureReason ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                  Форс-мажор: {reg.forceMajeureReason}
                </p>
              ) : null}

              <ForceMajeureCancelButton eventId={reg.event.id} enabled={Boolean(reg.canForceMajeure)} />

              {reg.canReviewAttendee ? (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-medium">Оценка участника</p>
                  <p className="text-xs text-muted-foreground">
                    Участник подтвердил присутствие — можно оставить отзыв.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      Оценка
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        className="w-20"
                        value={clientRating}
                        onChange={(e) => setClientRating(Number(e.target.value))}
                      />
                    </label>
                    <Input
                      placeholder="Отзыв о клиенте"
                      value={clientReview}
                      onChange={(e) => setClientReview(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="accent"
                      disabled={reviewAttendee.isPending}
                      onClick={() => reviewAttendee.mutate()}
                    >
                      {reviewAttendee.isPending ? "…" : "Сохранить отзыв"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {reg.instructorRating != null ? (
                <p className="text-sm text-muted-foreground">
                  Ваша оценка участника: {reg.instructorRating}/5
                  {reg.instructorReview ? ` · ${reg.instructorReview}` : ""}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {reg.canCancelRegistration ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={cancelReg.isPending}
                    onClick={() => cancelReg.mutate()}
                  >
                    {cancelReg.isPending ? "Отмена…" : "Отменить заявку"}
                  </Button>
                ) : reg.cancelRegistrationReason ? (
                  <p className="text-sm text-muted-foreground">{reg.cancelRegistrationReason}</p>
                ) : null}
                {reg.canRequestEventEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={requestEdit.isPending}
                    onClick={() => requestEdit.mutate()}
                  >
                    Изменить через модерацию
                  </Button>
                ) : null}
                <Button type="button" variant="outline" asChild>
                  <Link href="/instructor">К событиям</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
