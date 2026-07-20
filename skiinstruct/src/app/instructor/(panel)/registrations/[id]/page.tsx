"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  instructorRegistrationStatusLabel,
  type InstructorRegistrationListItem,
} from "@/lib/instructor-event-registration";
import { formatEventDateRu, formatEventPriceRu } from "@/lib/instructor-events";
import { PaidContactCallButton } from "@/features/chat/paid-contact-call";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
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
          "Вернуть мероприятие в черновик для правок? После изменений отправьте его на модерацию администратору.",
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
      toast.success(j.message ?? "Мероприятие в черновиках");
      await qc.invalidateQueries({ queryKey: ["instructor-events"] });
      router.push("/instructor#events");
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
              <CardTitle className="text-lg">Запись на мероприятие</CardTitle>
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

              {reg.status === "PAID" ||
              ((reg.amountRub ?? 0) <= 0 && reg.status !== "CANCELLED") ? (
                <PaidContactCallButton
                  contactUrl={`/api/instructor/registrations/${reg.id}/contact`}
                  label="Позвонить клиенту"
                />
              ) : null}

              {reg.eventEditHint ? (
                <p className="text-xs text-muted-foreground">{reg.eventEditHint}</p>
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
                  <Link href="/instructor">К мероприятиям</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
