"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { CancelRegistrationButton } from "@/features/orders/cancel-registration-button";
import { RegistrationChat } from "@/features/chat/registration-chat";
import {
  clientRegistrationStatusLabel,
  type ClientRegistrationDetail,
} from "@/lib/client-event-registration";
import { formatEventDateRu, formatEventPriceRu } from "@/lib/instructor-events";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export default function ClientRegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["client-registration", id],
    queryFn: async () => {
      const r = await fetch(`/api/client/registrations/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("registration");
      return r.json() as Promise<{ registration: ClientRegistrationDetail }>;
    },
    enabled: Boolean(id),
  });

  const autoConfirmStarted = useRef(false);

  const confirmAttendance = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/client/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "confirm_attendance" }),
      });
      const j = (await r.json()) as {
        checkoutUrl?: string | null;
        error?: string;
        message?: string;
      };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось подтвердить");
      return j;
    },
    onSuccess: async (j) => {
      await refetch();
      await qc.invalidateQueries({ queryKey: ["client-events"] });
      if (j.checkoutUrl) {
        if (j.checkoutUrl.includes("/client/registrations/")) {
          router.push(j.checkoutUrl.replace(/^https?:\/\/[^/]+/, "") || j.checkoutUrl);
        } else {
          window.location.href = j.checkoutUrl;
        }
        return;
      }
      toast.success(j.message ?? "Участие подтверждено");
      await qc.invalidateQueries({ queryKey: ["client-registrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const claimNoShowRefund = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/client/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "claim_instructor_no_show_refund" }),
      });
      const j = (await r.json()) as { error?: string; reason?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось оформить возврат");
      return j;
    },
    onSuccess: async (j) => {
      toast.success(j.reason ?? "Возврат оформлен");
      await qc.invalidateQueries({ queryKey: ["client-registrations"] });
      await refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payNow = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/client/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "pay" }),
      });
      const j = (await r.json()) as { checkoutUrl?: string; error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось открыть оплату");
      return j;
    },
    onSuccess: (j) => {
      if (!j.checkoutUrl) {
        toast.error("Ссылка на оплату не получена");
        return;
      }
      if (j.checkoutUrl.includes("/client/registrations/")) {
        router.push(j.checkoutUrl.replace(/^https?:\/\/[^/]+/, "") || j.checkoutUrl);
      } else {
        window.location.href = j.checkoutUrl;
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reg = data?.registration;

  useEffect(() => {
    const paid = searchParams.get("paid");
    if (paid === "1") toast.success("Оплата прошла — участие подтверждено");
    if (paid === "0") toast.message("Оплата не завершена");
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("confirm") !== "1" || autoConfirmStarted.current) return;
    if (!reg?.needsAttendanceConfirmation) return;
    autoConfirmStarted.current = true;
    confirmAttendance.mutate();
  }, [searchParams, reg, confirmAttendance]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/client">← К поиску инструктора</Link>
        </Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/client/orders">Мои заказы</Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : error || !reg ? (
        <p className="text-sm text-destructive">Заявка не найдена</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Запись на событие</CardTitle>
            <p className="text-sm text-muted-foreground">
              {clientRegistrationStatusLabel(reg.status)}
              {reg.amountRub > 0 ? ` · ${reg.amountRub.toLocaleString("ru-RU")} ₽` : " · Бесплатно"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h2 className="font-semibold">{reg.event.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {reg.instructor.name ?? "Инструктор"}
                {reg.event.eventAt ? ` · ${formatEventDateRu(reg.event.eventAt)}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Участие: {formatEventPriceRu(reg.event.priceRub)}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {reg.event.body}
            </p>

            {reg.status === "PAID" ? (
              <RegistrationChat
                registrationId={reg.id}
                contactUrl={`/api/client/registrations/${reg.id}/contact`}
                callLabel="Позвонить инструктору"
              />
            ) : null}

            <p className="text-xs text-muted-foreground">
              Заявка от {new Date(reg.createdAt).toLocaleString("ru-RU")}
              {reg.paidAt ? ` · оплачено ${new Date(reg.paidAt).toLocaleString("ru-RU")}` : ""}
              {reg.attendanceConfirmedAt
                ? ` · участие подтверждено ${new Date(reg.attendanceConfirmedAt).toLocaleString("ru-RU")}`
                : ""}
            </p>

            {reg.needsAttendanceConfirmation ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Событие завершилось. Подтвердите, что вы были на нём
                {reg.amountRub > 0 && !reg.paidAt
                  ? " — сначала завершите оплату записи."
                  : "."}
              </p>
            ) : null}

            {reg.status === "PENDING_PAYMENT" && reg.amountRub > 0 && !reg.paidAt ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Запись ещё не подтверждена. Оплатите участие — после оплаты место закрепится, и
                инструктор получит уведомление.
              </p>
            ) : null}

            {reg.attendanceConfirmedAt ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                Участие подтверждено. Спасибо!
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {reg.status === "PENDING_PAYMENT" && reg.amountRub > 0 && !reg.paidAt ? (
                <Button
                  type="button"
                  variant="accent"
                  disabled={payNow.isPending}
                  onClick={() => payNow.mutate()}
                >
                  {payNow.isPending ? "…" : "Оплатить"}
                </Button>
              ) : null}
              {reg.needsAttendanceConfirmation ? (
                <Button
                  type="button"
                  variant="accent"
                  disabled={confirmAttendance.isPending}
                  onClick={() => confirmAttendance.mutate()}
                >
                  {confirmAttendance.isPending
                    ? "…"
                    : reg.amountRub > 0 && !reg.paidAt
                      ? "Оплатить"
                      : "Подтвердить участие"}
                </Button>
              ) : null}
              {reg.instructorNoShowRefundEligible ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={claimNoShowRefund.isPending}
                  onClick={() => claimNoShowRefund.mutate()}
                >
                  {claimNoShowRefund.isPending ? "…" : "Инструктор не пришёл — полный возврат"}
                </Button>
              ) : null}
              {reg.canCancel ? (
                <CancelRegistrationButton
                  registrationId={reg.id}
                  onCancelled={async () => {
                    await qc.invalidateQueries({ queryKey: ["client-registrations"] });
                    await qc.invalidateQueries({ queryKey: ["orders"] });
                    await qc.invalidateQueries({ queryKey: ["client-events"] });
                    await refetch();
                    router.push("/client/orders");
                  }}
                />
              ) : reg.cancelReason ? (
                <p className="text-sm text-muted-foreground">{reg.cancelReason}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
