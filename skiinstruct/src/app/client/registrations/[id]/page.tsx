"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CancelRegistrationButton } from "@/features/orders/cancel-registration-button";
import { EventVenueDisplay } from "@/features/orders/event-venue-display";
import { RegistrationChat } from "@/features/chat/registration-chat";
import {
  clientRegistrationStatusLabel,
  type ClientRegistrationDetail,
} from "@/lib/client-event-registration";
import { formatEventDateRu, formatEventPriceRu, registrationStatusClassName } from "@/lib/instructor-events";
import { formatEventPartyRu } from "@/lib/event-party";
import { syncYooEventRegistrationPayment } from "@/lib/payments/redirect-to-checkout";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";

export default function ClientRegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const paidToastShown = useRef(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

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
  const pendingPaymentSyncTried = useRef(false);

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

  const leaveReview = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/client/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "add_review", rating, review }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось сохранить отзыв");
      return j;
    },
    onSuccess: async () => {
      toast.success("Спасибо за отзыв");
      await refetch();
      await qc.invalidateQueries({ queryKey: ["client-registrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reg = data?.registration;

  useEffect(() => {
    if (paidToastShown.current || !id) return;
    const paid = searchParams.get("paid");
    if (paid === "1") {
      paidToastShown.current = true;
      const isMock = Boolean(searchParams.get("mock"));
      void (async () => {
        if (!isMock) {
          try {
            const synced = await syncYooEventRegistrationPayment(id);
            await qc.invalidateQueries({ queryKey: ["client-registration", id] });
            await qc.invalidateQueries({ queryKey: ["client-registrations"] });
            await qc.invalidateQueries({ queryKey: ["client-events"] });
            if (!synced.paid) {
              toast.message(
                "В ЮKassa оплата ещё не завершена. Нажмите «Оплатить» и дождитесь подтверждения банка.",
              );
              router.replace(`/client/registrations/${id}`, { scroll: false });
              return;
            }
          } catch {
            toast.message("Не удалось подтвердить оплату. Обновите страницу через минуту.");
            router.replace(`/client/registrations/${id}`, { scroll: false });
            return;
          }
        }
        toast.success("Оплата прошла — участие подтверждено");
        router.replace(`/client/registrations/${id}`, { scroll: false });
      })();
    } else if (paid === "0") {
      paidToastShown.current = true;
      toast.message("Оплата не завершена");
      router.replace(`/client/registrations/${id}`, { scroll: false });
    }
  }, [searchParams, id, router, qc]);

  // Если webhook не дошёл, а пользователь открыл заявку без ?paid=1 — дотягиваем статус.
  useEffect(() => {
    if (!id || !reg) return;
    if (reg.status !== "PENDING_PAYMENT" || !(reg.amountRub > 0) || reg.paidAt) return;
    if (searchParams.get("paid") === "1") return;
    if (pendingPaymentSyncTried.current) return;
    pendingPaymentSyncTried.current = true;
    void (async () => {
      try {
        const synced = await syncYooEventRegistrationPayment(id);
        if (!synced.paid) return;
        await qc.invalidateQueries({ queryKey: ["client-registration", id] });
        await qc.invalidateQueries({ queryKey: ["client-registrations"] });
        toast.success("Оплата подтверждена");
      } catch {
        /* ignore — webhook или повторная оплата */
      }
    })();
  }, [id, reg, searchParams, qc]);

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
              <span className={registrationStatusClassName(reg.status)}>
                {clientRegistrationStatusLabel(reg.status, { amountRub: reg.amountRub })}
              </span>
              {reg.amountRub > 0 ? ` · ${reg.amountRub.toLocaleString("ru-RU")} ₽` : " · бесплатно"}
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
                Состав: {formatEventPartyRu(reg)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Участие:{" "}
                {reg.amountRub > 0
                  ? `${reg.amountRub.toLocaleString("ru-RU")} ₽`
                  : formatEventPriceRu(reg.event.priceRub)}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {reg.event.body}
            </p>
            <EventVenueDisplay
              address={reg.event.venueAddress}
              lat={reg.event.venueLat}
              lng={reg.event.venueLng}
            />
            {!reg.event.venueAddress?.trim() ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Адрес проведения в карточке события не указан — уточните место у инструктора в чате или по звонку.
              </p>
            ) : null}

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

            {reg.canLeaveReview ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium">Оценка инструктора</p>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    Оценка
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      className="w-20"
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                    />
                  </label>
                  <Input
                    placeholder="Отзыв"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="accent"
                    disabled={leaveReview.isPending}
                    onClick={() => leaveReview.mutate()}
                  >
                    {leaveReview.isPending ? "…" : "Отправить отзыв"}
                  </Button>
                </div>
              </div>
            ) : null}

            {reg.clientRating != null ? (
              <p className="text-sm text-muted-foreground">
                Ваша оценка: {reg.clientRating}/5
                {reg.clientReview ? ` · ${reg.clientReview}` : ""}
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
