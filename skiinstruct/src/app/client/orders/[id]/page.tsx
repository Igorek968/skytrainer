"use client";

import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { OrderChat } from "@/features/chat/order-chat";
import { CancelOrderButton, ClaimLateRefundButton } from "@/features/orders/cancel-order-button";
import { LEGAL_ROUTES } from "@/lib/legal";
import { INSTRUCTOR_LATE_GRACE_MINUTES } from "@/lib/legal-config";
import { redirectToOrderCheckout } from "@/lib/payments/redirect-to-checkout";
import { devPollInterval } from "@/lib/query-poll";
import { NearbyMapLazy } from "@/features/map/map-loader";
import {
  formatUrgentCountdown,
  orderIsTodayLessonDay,
  orderIsUrgent,
  orderRelaxedInstructorTiming,
  orderSpansMultipleLessonDays,
  urgentDeadlineLabel,
} from "@/shared/lib/order-flex";
import { useCountdownToDeadline } from "@/shared/hooks/use-countdown-to-deadline";
import {
  extractInstructorEtaMinutes,
  formatArrivalCountdownRu,
  resolveInstructorArrivalDeadlineMs,
} from "@/shared/lib/order-instructor-eta";
import { isInLessonStartPopupWindow, msUntilLessonStart } from "@/shared/lib/order-lesson-start";
import { resolveMeetAddress } from "@/shared/lib/order-meet-address";
import { extractClientWishNotes, skillLevelLabelRu } from "@/shared/lib/order-booking-labels";
import {
  formatOrderSumWithDuration,
  lessonDurationLabelRu,
  resolveOrderDisplayDuration,
} from "@/shared/lib/order-duration";
import { parseDisciplineFromOrderNotes } from "@/lib/instructor-specialization-offers";
import {
  clientCanRemoveOrderFromHistory,
  clientPaymentStatusLabel,
  orderStatusLabel,
} from "@/shared/lib/order-status";
import { OrderCancellationSide } from "@/shared/ui/order-cancellation-side";
import { OrderLessonTimeBlock } from "@/shared/ui/order-lesson-time-block";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import type { LessonDuration, Order, OrderStatus, SkillLevel } from "@prisma/client";

type RoutingMember = { userId: string; name: string | null };

function formatCountdownHhMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec
    .toString()
    .padStart(2, "0")}`;
}

function formatCountdownRuHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h} ч ${m} мин ${sec} сек`;
}

type OrderDTO = Order & {
  client: { id: string; name: string | null; image: string | null };
  instructor: {
    id: string;
    name: string | null;
    image: string | null;
    instructorProfile: {
      lat: number | null;
      lng: number | null;
      hourlyRate: unknown;
      specializations?: string[];
    } | null;
  } | null;
  resort: { name: string } | null;
};

type OrderPayload = { order: OrderDTO; routingQueue?: RoutingMember[] };

type DetailMutations = {
  patch: UseMutationResult<unknown, Error, Record<string, unknown>>;
  removeFromHistory: UseMutationResult<void, Error, void>;
  payOrder: UseMutationResult<void, Error, { bindAndPay?: boolean } | undefined>;
};

/** Контент с хуками, зависящими от загруженного заказа — монтируется только когда `data` есть. */
function parsePendingExpiresMs(raw: OrderDTO["pendingExpiresAt"]): number | null {
  if (raw == null) return null;
  const t = new Date(raw as string | Date).getTime();
  return Number.isFinite(t) ? t : null;
}

function formatDateTimeRu(raw: string | Date | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

function formatDateRu(raw: string | Date | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
}

function calendarYmdMoscow(raw: string | Date | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

function ClientOrderDetailContent({
  id,
  data,
  mutations,
}: {
  id: string;
  data: OrderPayload;
  mutations: DetailMutations;
}) {
  const { patch, removeFromHistory, payOrder } = mutations;
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [useReferralBalance, setUseReferralBalance] = useState(false);
  const queryClient = useQueryClient();
  const o = data.order;
  const routingQueue = data.routingQueue;
  const statusEarly = o?.status as OrderStatus | undefined;

  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const pendingExpiresMs = parsePendingExpiresMs(o?.pendingExpiresAt);
  const isUrgentEarly = Boolean(o?.urgentInvite);
  const pendingCountdownEnabled =
    statusEarly === "PENDING_INSTRUCTOR" && isUrgentEarly && pendingExpiresMs != null;
  const secondsLeft = useCountdownToDeadline(pendingExpiresMs, pendingCountdownEnabled);

  const arrivalDeadlineMs = useMemo(
    () =>
      resolveInstructorArrivalDeadlineMs({
        instructorEtaAt: o?.instructorEtaAt,
        acceptedAt: o?.acceptedAt,
        notes: o?.notes,
      }),
    [o?.instructorEtaAt, o?.acceptedAt, o?.notes],
  );
  const lessonStartMs = useMemo(() => {
    if (!o?.requestedStartDate) return null;
    const t = new Date(o.requestedStartDate).getTime();
    return Number.isFinite(t) ? t : null;
  }, [o?.requestedStartDate]);

  const lessonStartCountdownEnabled =
    lessonStartMs != null &&
    (statusEarly === "PENDING_INSTRUCTOR" ||
      statusEarly === "ACCEPTED" ||
      statusEarly === "INSTRUCTOR_EN_ROUTE" ||
      statusEarly === "LESSON_STARTED") &&
    msUntilLessonStart(o?.requestedStartDate) != null &&
    (msUntilLessonStart(o?.requestedStartDate) ?? 0) > 0;

  const lessonStartSecondsLeft = useCountdownToDeadline(lessonStartMs, lessonStartCountdownEnabled);
  const meetArrivalCountdownEnabled =
    arrivalDeadlineMs != null &&
    (statusEarly === "ACCEPTED" ||
      statusEarly === "INSTRUCTOR_EN_ROUTE" ||
      statusEarly === "LESSON_STARTED");
  const meetArrivalSecondsLeft = useCountdownToDeadline(
    arrivalDeadlineMs,
    meetArrivalCountdownEnabled,
  );

  if (!o) {
    return <p className="text-destructive">Заказ не найден или данные не загрузились.</p>;
  }

  const status = o.status as OrderStatus;
  const timingInput = {
    urgentInvite: Boolean(o.urgentInvite),
    flexibleInstructorInvite: Boolean(o.flexibleInstructorInvite),
    requestedDays: o.requestedDays,
    requestedStartDate: o.requestedStartDate,
  };
  const relaxedTiming = orderRelaxedInstructorTiming(timingInput);
  const isUrgent = orderIsUrgent(timingInput);
  const lessonToday = orderIsTodayLessonDay(timingInput);
  const multiDay = orderSpansMultipleLessonDays(timingInput);
  const discipline =
    o.disciplineLabel?.trim() ||
    parseDisciplineFromOrderNotes(o.notes) ||
    o.instructor?.instructorProfile?.specializations?.[0] ||
    "Не указано";
  const clientWishes = extractClientWishNotes(o.notes);
  const displayDuration = resolveOrderDisplayDuration({
    duration: o.duration as LessonDuration,
    requestedStartDate: o.requestedStartDate,
    requestedEndDate: o.requestedEndDate,
    notes: o.notes,
    amountTotal: o.amountTotal != null ? Number(o.amountTotal) : null,
    agreedHourlyRate: o.agreedHourlyRate != null ? Number(o.agreedHourlyRate) : null,
  });
  const instructorEtaMinutes = extractInstructorEtaMinutes(o.notes);
  const meetPlace = resolveMeetAddress(o);

  const { data: referralMe } = useQuery({
    queryKey: ["referral-me"],
    queryFn: async () => {
      const r = await fetch("/api/referral/me", { credentials: "include" });
      if (!r.ok) return null;
      return r.json() as Promise<{ balanceRub: number }>;
    },
    enabled: statusEarly === "AWAITING_PAYMENT",
  });

  const { data: cardStatus } = useQuery({
    queryKey: ["me-card-status"],
    queryFn: async () => {
      const r = await fetch("/api/me/payment-method", { cache: "no-store" });
      if (!r.ok) throw new Error("card");
      return r.json() as Promise<{ hasCard: boolean; brand: string | null; last4: string | null }>;
    },
    enabled: statusEarly === "AWAITING_PAYMENT",
  });
  const hasBoundCard = Boolean(cardStatus?.hasCard);

  const referralCreditApplied = Number(o.referralCreditAppliedRub ?? 0);
  const orderTotal = Number(o.amountTotal ?? 0);
  const amountDue = Math.max(0, orderTotal - referralCreditApplied);

  const applyReferralCredit = useMutation({
    mutationFn: async (useCredit: boolean) => {
      const r = await fetch(`/api/orders/${id}/referral-credit`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useCredit }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не удалось применить баланс");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["order", id] });
      await queryClient.invalidateQueries({ queryKey: ["referral-me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lateRefundEligible =
    o.paymentStatus === "PAID" &&
    !o.lateRefundClaimedAt &&
    !o.lessonStartedAt &&
    (status === "ACCEPTED" || status === "INSTRUCTOR_EN_ROUTE") &&
    arrivalDeadlineMs != null &&
    Date.now() >= arrivalDeadlineMs + INSTRUCTOR_LATE_GRACE_MINUTES * 60_000;

  const refreshOrder = () => void queryClient.invalidateQueries({ queryKey: ["order", id] });

  const instrPos =
    o.instructor?.instructorProfile?.lat != null &&
    o.instructor?.instructorProfile?.lng != null
      ? ([o.instructor.instructorProfile.lat, o.instructor.instructorProfile.lng] as [
          number,
          number,
        ])
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link className="underline" href="/client/orders">
              ← Назад
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{orderStatusLabel(status)}</h1>
          <p className="text-sm text-muted-foreground">
            Создан: {formatDateTimeRu(o.createdAt)}
          </p>
          {status === "EXPIRED" ? (
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Выбранный инструктор не принял заявку в срок, отклонил её или был недоступен онлайн.
              {o.paymentStatus === "PAID"
                ? " Оплаченная сумма возвращается на карту (полный возврат)."
                : null}{" "}
              Создайте новый заказ позже или выберите другого инструктора.
            </p>
          ) : null}
        </div>
      </div>

      {(status === "ACCEPTED" ||
        status === "INSTRUCTOR_EN_ROUTE" ||
        status === "LESSON_STARTED") &&
      instrPos ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Инструктор на карте</CardTitle>
          </CardHeader>
          <CardContent>
            <NearbyMapLazy
              interactive={false}
              center={[o.meetLat, o.meetLng]}
              meetLat={o.meetLat}
              meetLng={o.meetLng}
              radiusKm={5}
              instructors={[
                {
                  id: o.instructor!.id,
                  name: o.instructor!.name,
                  lat: instrPos[0],
                  lng: instrPos[1],
                  hourlyRate: Number(o.instructor!.instructorProfile?.hourlyRate ?? 0),
                  ratingAvg: 0,
                  distanceKm: 0,
                },
              ]}
              onMeetChange={() => {
                /* readonly */
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {lessonStartMs != null && lessonStartCountdownEnabled && lessonStartSecondsLeft != null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">До начала встречи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Запланированное начало:{" "}
              <span className="font-medium text-foreground">
                {new Date(o.requestedStartDate!).toLocaleString("ru-RU", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Europe/Moscow",
                })}
              </span>
            </p>
            <div
              className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-sky-700 dark:text-sky-300"
              aria-live="polite"
              aria-atomic="true"
            >
              {formatCountdownHhMmSs(lessonStartSecondsLeft)}
            </div>
            <p className="text-xs text-muted-foreground">Формат: чч:мм:сс</p>
            <p className="text-xs text-muted-foreground">
              ({formatCountdownRuHms(lessonStartSecondsLeft)})
              {isInLessonStartPopupWindow(o.requestedStartDate)
                ? " · скоро встреча с инструктором"
                : null}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {status === "PENDING_INSTRUCTOR" && routingQueue && routingQueue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {o.urgentInvite
                ? "⚡ Срочная заявка"
                : o.flexibleInstructorInvite
                ? "Запись на дату"
                : lessonToday
                  ? "Заявка на сегодня"
                  : relaxedTiming
                    ? "Бронь на несколько дней"
                    : "Кому сейчас предложена заявка"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {relaxedTiming ? (
              o.flexibleInstructorInvite ? (
                <p className="text-muted-foreground">
                  Заявка отправлена выбранному инструктору. Он получил уведомление и может ответить, когда будет
                  готов — <strong>без ограничения по времени</strong>.
                </p>
              ) : lessonToday ? (
                <p className="text-muted-foreground">
                  Заявка на сегодня у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Он уведомлён и
                  может принять, когда будет готов.
                </p>
              ) : multiDay ? (
                <p className="text-muted-foreground">
                  Заявка на несколько дней у выбранного инструктора: без срочного ETA до встречи — согласование
                  по датам и времени в чате или при встрече.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Ответ без ограничения по
                  времени.
                </p>
              )
            ) : isUrgent ? (
              <p className="text-muted-foreground">
                ⚡ Срочная заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. На принятие —{" "}
                <strong>{urgentDeadlineLabel()}</strong>. Если время истекает или он отклоняет заявку, заказ
                закрывается с полным возвратом.
              </p>
            ) : null}
            {isUrgent && pendingExpiresMs != null ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-medium text-amber-800 dark:text-amber-200">
                Осталось:{" "}
                <span className="font-mono tabular-nums">{formatUrgentCountdown(secondsLeft ?? 0)}</span>
              </div>
            ) : null}
            <div className="font-medium">
              Инструктор: <span className="text-foreground">{o.instructor?.name ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      ) : status === "PENDING_INSTRUCTOR" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {o.urgentInvite
                ? "⚡ Срочная заявка"
                : o.flexibleInstructorInvite
                ? "Ожидание ответа инструктора"
                : lessonToday
                  ? "Ожидание ответа (урок сегодня)"
                  : relaxedTiming
                    ? "Ожидание ответа (несколько дней)"
                    : "Ожидание инструктора"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {relaxedTiming ? (
              o.flexibleInstructorInvite ? (
                <p className="text-muted-foreground">
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Он уведомлён и сможет
                  принять заявку позже.
                </p>
              ) : lessonToday ? (
                <p className="text-muted-foreground">
                  Заявка на сегодня у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Он уведомлён и
                  может принять, когда будет готов.
                </p>
              ) : multiDay ? (
                <p className="text-muted-foreground">
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong> на несколько дней. Срочный
                  ETA до встречи не требуется.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Ответ без ограничения по
                  времени.
                </p>
              )
            ) : isUrgent ? (
              <p className="text-muted-foreground">
                ⚡ Срочная заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. На ответ —{" "}
                <strong>{urgentDeadlineLabel()}</strong>; иначе заказ закрывается с полным возвратом.
              </p>
            ) : null}
            {isUrgent && pendingExpiresMs != null ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-medium text-amber-800 dark:text-amber-200">
                Осталось:{" "}
                <span className="font-mono tabular-nums">{formatUrgentCountdown(secondsLeft ?? 0)}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {status === "AWAITING_PAYMENT" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Оплата перед отправкой инструктору</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Средства резервируются на стороне платформы. После успешной оплаты заявка уходит только выбранному
              инструктору.
              Комиссия сервиса уже учтена в сумме (15% от ставки за занятие); после того как инструктор отметит
              урок выполненным, доля инструктора считается переданной за вычетом этой комиссии.
            </p>
            {!hasBoundCard ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
                Банковская карта не привязана. Нажмите «Привязать карту и оплатить» — откроется форма ЮKassa. Без
                карты заказ инструктору не отправится.
              </p>
            ) : (
              <p className="text-foreground">
                Карта: {cardStatus?.brand?.toUpperCase() ?? "CARD"} •••• {cardStatus?.last4 ?? "****"}
              </p>
            )}
            {o.paymentStatus === "PENDING" && o.amountTotal ? (
              <div className="space-y-3">
                {(referralMe?.balanceRub ?? 0) > 0 ? (
                  <label className="flex cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={useReferralBalance || referralCreditApplied > 0}
                      disabled={applyReferralCredit.isPending}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setUseReferralBalance(next);
                        applyReferralCredit.mutate(next);
                      }}
                    />
                    <span>
                      Списать реферальный баланс (
                      {(referralMe?.balanceRub ?? 0).toFixed(0)} ₽ доступно
                      {referralCreditApplied > 0 ? `, −${referralCreditApplied.toFixed(0)} ₽` : ""})
                    </span>
                  </label>
                ) : null}
                <p className="font-medium text-foreground">
                  К оплате: {amountDue.toFixed(0)} ₽
                  {referralCreditApplied > 0 ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (из {orderTotal.toFixed(0)} ₽)
                    </span>
                  ) : null}
                </p>
                <label className="flex cursor-pointer gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    required
                    checked={acceptLegal}
                    onChange={(e) => setAcceptLegal(e.target.checked)}
                  />
                  <span>
                    Я принимаю условия{" "}
                    <Link className="text-accent underline" href={LEGAL_ROUTES.oferta} target="_blank">
                      Договора-оферты
                    </Link>{" "}
                    и даю согласие на обработку{" "}
                    <Link className="text-accent underline" href={LEGAL_ROUTES.privacy} target="_blank">
                      персональных данных
                    </Link>
                    .
                  </span>
                </label>
                <Button
                  type="button"
                  variant="accent"
                  disabled={!acceptLegal || payOrder.isPending}
                  onClick={() => {
                    if (!acceptLegal) {
                      toast.error("Подтвердите согласие с офертой и обработкой персональных данных");
                      return;
                    }
                    payOrder.mutate({ bindAndPay: !hasBoundCard });
                  }}
                >
                  {hasBoundCard ? "Оплатить и отправить заявку" : "Привязать карту и оплатить"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Детали</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            Статус: <span className="font-medium">{orderStatusLabel(status)}</span>
          </div>
          <div>
            Создан: <span className="font-medium">{formatDateTimeRu(o.createdAt)}</span>
          </div>
          <div>
            Инструктор: <span className="font-medium">{o.instructor?.name ?? "—"}</span>
          </div>
          <div>
            Дисциплина: <span className="font-medium">{discipline}</span>
          </div>
          <div>
            Уровень:{" "}
            <span className="font-medium">{skillLevelLabelRu(o.skillLevel as SkillLevel)}</span>
          </div>
          <div>
            Длительность:{" "}
            <span className="font-medium">{lessonDurationLabelRu(displayDuration)}</span>
          </div>
          <div>
            Язык инструктора: <span className="font-medium">{o.languagePref?.trim() || "—"}</span>
          </div>
          {o.requestedStartDate ? (
            <div>
              Период занятий:{" "}
              <span className="font-medium">
                {formatDateRu(o.requestedStartDate)}
                {o.requestedEndDate &&
                calendarYmdMoscow(o.requestedEndDate) !==
                  calendarYmdMoscow(o.requestedStartDate)
                  ? ` — ${formatDateRu(o.requestedEndDate)}`
                  : null}
                {o.requestedDays != null && o.requestedDays > 1 ? ` (${o.requestedDays} дн.)` : null}
              </span>
            </div>
          ) : null}
          <OrderLessonTimeBlock order={o} timeClassName="font-medium" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span>
              Место встречи:{" "}
              <span className="font-medium">{meetPlace ?? "—"}</span>
            </span>
            {meetArrivalCountdownEnabled && meetArrivalSecondsLeft != null ? (
              <span
                className="shrink-0 text-right font-mono text-xl font-semibold tabular-nums leading-tight text-emerald-700 dark:text-emerald-300 sm:text-2xl"
                aria-live="polite"
                aria-atomic="true"
                data-eta-countdown="live"
              >
                {instructorEtaMinutes != null ? (
                  <span className="mr-1.5 font-sans text-base font-semibold text-emerald-800/90 dark:text-emerald-200/90 sm:text-lg">
                    ~{instructorEtaMinutes} мин ·
                  </span>
                ) : null}
                {meetArrivalSecondsLeft > 0
                  ? formatCountdownHhMmSs(meetArrivalSecondsLeft)
                  : "ожидаем на месте"}
              </span>
            ) : null}
          </div>
          <div>
            Сумма:{" "}
            <span className="font-medium">
              {formatOrderSumWithDuration(
                o.amountTotal != null ? Number(o.amountTotal) : null,
                displayDuration,
              )}
            </span>
          </div>
          <div>
            Оплата: <span className="font-medium">{clientPaymentStatusLabel(o.paymentStatus)}</span>
          </div>
          <OrderCancellationSide status={status} cancelledBy={o.cancelledBy} />
          {clientWishes ? (
            <div className="whitespace-pre-wrap">
              Пожелания: <span className="font-medium">{clientWishes}</span>
            </div>
          ) : null}
          {lessonStartMs != null && lessonStartSecondsLeft != null ? (
            <div
              className="font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl"
              aria-live="polite"
              aria-atomic="true"
            >
              До начала занятия:{" "}
              {lessonStartSecondsLeft > 0
                ? formatArrivalCountdownRu(lessonStartSecondsLeft)
                : "началось"}
            </div>
          ) : null}
          {instructorEtaMinutes != null && !meetArrivalCountdownEnabled ? (
            <div>Инструктор на месте встречи через ~{instructorEtaMinutes} мин</div>
          ) : null}
          {status === "COMPLETED" ? (
            <div className="rounded-md border border-border bg-muted/20 p-2">
              <div>Начало занятия: {formatDateTimeRu(o.lessonStartedAt)}</div>
              <div>Завершение занятия: {formatDateTimeRu(o.lessonEndedAt)}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(status === "DRAFT" ||
          status === "AWAITING_PAYMENT" ||
          status === "PENDING_INSTRUCTOR" ||
          status === "ACCEPTED" ||
          status === "INSTRUCTOR_EN_ROUTE") && (
          <CancelOrderButton orderId={id} disabled={patch.isPending} onCancelled={refreshOrder} />
        )}

        {lateRefundEligible ? (
          <ClaimLateRefundButton orderId={id} disabled={patch.isPending} onDone={refreshOrder} />
        ) : null}

        {clientCanRemoveOrderFromHistory(status) ? (
          <Button
            type="button"
            variant="outline"
            disabled={removeFromHistory.isPending || patch.isPending}
            onClick={() => {
              if (
                !confirm(
                  "Удалить заказ из истории? Данные будут удалены без возможности восстановления."
                )
              ) {
                return;
              }
              removeFromHistory.mutate();
            }}
          >
            Удалить из истории
          </Button>
        ) : null}

        {status === "COMPLETED" && o.paymentStatus === "PENDING" ? (
          <>
            <Button type="button" variant="accent" onClick={() => payOrder.mutate(undefined)}>
              Оплатить картой
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={patch.isPending}
              onClick={() =>
                patch.mutate(
                  { action: "set_payment_cash" },
                  { onSuccess: () => toast.success("Отмечено: наличные") }
                )
              }
            >
              Оплата наличными
            </Button>
          </>
        ) : null}

        {status === "COMPLETED" && o.paymentStatus === "FAILED" ? (
          <>
            <Button type="button" variant="accent" onClick={() => payOrder.mutate(undefined)}>
              Оплатить картой
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={patch.isPending}
              onClick={() =>
                patch.mutate(
                  { action: "set_payment_cash" },
                  { onSuccess: () => toast.success("Отмечено: наличные") }
                )
              }
            >
              Оплата наличными
            </Button>
          </>
        ) : null}

        {status === "COMPLETED" && o.clientRating == null ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-base">Оценка инструктора</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
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
                disabled={patch.isPending}
                onClick={() =>
                  patch.mutate(
                    { action: "add_review", rating, review },
                    { onSuccess: () => toast.success("Спасибо за отзыв") }
                  )
                }
              >
                Отправить отзыв
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {status !== "PENDING_INSTRUCTOR" &&
      status !== "AWAITING_PAYMENT" &&
      status !== "CANCELLED" ? (
        <OrderChat orderId={id} />
      ) : null}
    </div>
  );
}

export default function ClientOrderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const autoPayStarted = useRef(false);
  const paidToastShown = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const r = await fetch(`/api/orders/${id}`);
      if (!r.ok) throw new Error("order");
      return r.json() as Promise<OrderPayload>;
    },
    refetchInterval: devPollInterval(5000),
  });

  const { data: cardStatus } = useQuery({
    queryKey: ["me-card-status", id],
    queryFn: async () => {
      const r = await fetch("/api/me/payment-method", { cache: "no-store" });
      if (!r.ok) throw new Error("card");
      return r.json() as Promise<{ hasCard: boolean }>;
    },
    enabled: Boolean(data?.order && data.order.status === "AWAITING_PAYMENT"),
  });

  const removeFromHistory = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof j.error === "string" ? j.error : "delete");
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Заказ удалён из истории");
      router.push("/client/orders");
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось удалить"),
  });

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof j.error === "string" ? j.error : "patch");
      }
      return r.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["order", id] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const payOrder = useMutation({
    mutationFn: async (opts?: { bindAndPay?: boolean }) => {
      await redirectToOrderCheckout(id, { bindAndPay: opts?.bindAndPay });
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка оплаты"),
  });

  useEffect(() => {
    if (paidToastShown.current) return;
    const paid = searchParams.get("paid");
    if (paid === "1") {
      paidToastShown.current = true;
      toast.success(
        searchParams.get("mock")
          ? "Тестовая оплата прошла — заявка отправлена инструктору"
          : "Оплата прошла — заявка отправлена инструктору",
      );
      router.replace(`/client/orders/${id}`, { scroll: false });
    } else if (paid === "0") {
      paidToastShown.current = true;
      toast.message("Оплата не завершена");
      router.replace(`/client/orders/${id}`, { scroll: false });
    }
  }, [searchParams, id, router]);

  useEffect(() => {
    if (autoPayStarted.current) return;
    if (searchParams.get("pay") !== "1") return;
    if (!data?.order || data.order.status !== "AWAITING_PAYMENT") return;
    if (cardStatus == null) return;
    autoPayStarted.current = true;
    router.replace(`/client/orders/${id}`, { scroll: false });
    payOrder.mutate({ bindAndPay: !cardStatus.hasCard });
  }, [searchParams, data, cardStatus, id, router, payOrder]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data || !data.order) {
    return <p className="text-destructive">Заказ не найден</p>;
  }

  return (
    <ClientOrderDetailContent
      key={id}
      id={id}
      data={data}
      mutations={{ patch, removeFromHistory, payOrder }}
    />
  );
}
