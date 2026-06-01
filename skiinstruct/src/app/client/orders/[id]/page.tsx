"use client";

import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { OrderChat } from "@/features/chat/order-chat";
import { CancelOrderButton, ClaimLateRefundButton } from "@/features/orders/cancel-order-button";
import { INSTRUCTOR_LATE_GRACE_MINUTES } from "@/lib/legal-config";
import { devPollInterval } from "@/lib/query-poll";
import { NearbyMapLazy } from "@/features/map/map-loader";
import {
  orderIsTodayLessonDay,
  orderRelaxedInstructorTiming,
  orderSpansMultipleLessonDays,
} from "@/shared/lib/order-flex";
import { useCountdownToDeadline } from "@/shared/hooks/use-countdown-to-deadline";
import {
  extractInstructorEtaMinutes,
  formatArrivalCountdownRu,
  formatCountdownMmSs,
  resolveInstructorArrivalDeadlineMs,
} from "@/shared/lib/order-instructor-eta";
import { isInLessonStartPopupWindow, msUntilLessonStart } from "@/shared/lib/order-lesson-start";
import { resolveMeetAddress } from "@/shared/lib/order-meet-address";
import {
  clientCanRemoveOrderFromHistory,
  clientPaymentStatusLabel,
  orderStatusLabel,
} from "@/shared/lib/order-status";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import type { Order, OrderStatus } from "@prisma/client";

type RoutingMember = { userId: string; name: string | null };

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
  payStripe: UseMutationResult<void, Error, void>;
};

/** Контент с хуками, зависящими от загруженного заказа — монтируется только когда `data` есть. */
function parsePendingExpiresMs(raw: OrderDTO["pendingExpiresAt"]): number | null {
  if (raw == null) return null;
  const t = new Date(raw as string | Date).getTime();
  return Number.isFinite(t) ? t : null;
}

function extractDiscipline(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const line = notes
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.toLowerCase().startsWith("дисциплина:"));
  if (!line) return null;
  const value = line.slice("дисциплина:".length).trim();
  return value || null;
}

function formatDateTimeRu(raw: string | Date | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
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
  const { patch, removeFromHistory, payStripe } = mutations;
  const queryClient = useQueryClient();
  const o = data.order;
  const routingQueue = data.routingQueue;
  const statusEarly = o?.status as OrderStatus | undefined;

  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const pendingExpiresMs = parsePendingExpiresMs(o?.pendingExpiresAt);
  const pendingCountdownEnabled = statusEarly === "PENDING_INSTRUCTOR" && pendingExpiresMs != null;
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
  const arrivalCountdownEnabled =
    arrivalDeadlineMs != null &&
    (statusEarly === "ACCEPTED" ||
      statusEarly === "INSTRUCTOR_EN_ROUTE" ||
      statusEarly === "LESSON_STARTED");
  const arrivalSecondsLeft = useCountdownToDeadline(arrivalDeadlineMs, arrivalCountdownEnabled);

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
  const meetCountdownSecondsLeft = useCountdownToDeadline(lessonStartMs, lessonStartMs != null);

  if (!o) {
    return <p className="text-destructive">Заказ не найден или данные не загрузились.</p>;
  }

  const status = o.status as OrderStatus;
  const timingInput = {
    flexibleInstructorInvite: Boolean(o.flexibleInstructorInvite),
    requestedDays: o.requestedDays,
    requestedStartDate: o.requestedStartDate,
  };
  const relaxedTiming = orderRelaxedInstructorTiming(timingInput);
  const lessonToday = orderIsTodayLessonDay(timingInput);
  const multiDay = orderSpansMultipleLessonDays(timingInput);
  const discipline =
    extractDiscipline(o.notes) ??
    o.instructor?.instructorProfile?.specializations?.[0] ??
    "Не указано";
  const instructorEtaMinutes = extractInstructorEtaMinutes(o.notes);
  const meetPlace = resolveMeetAddress(o);

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
            Создан: {new Date(o.createdAt).toLocaleString("ru-RU")}
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
                })}
              </span>
            </p>
            <div
              className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-sky-700 dark:text-sky-300"
              aria-live="polite"
              aria-atomic="true"
            >
              {formatCountdownMmSs(lessonStartSecondsLeft)}
            </div>
            <p className="text-xs text-muted-foreground">
              ({formatArrivalCountdownRu(lessonStartSecondsLeft)})
              {isInLessonStartPopupWindow(o.requestedStartDate)
                ? " · скоро встреча с инструктором"
                : null}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {arrivalDeadlineMs != null &&
      (status === "ACCEPTED" || status === "INSTRUCTOR_EN_ROUTE" || status === "LESSON_STARTED") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ожидаемое прибытие инструктора</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {arrivalSecondsLeft != null ? (
              <>
                <p className="text-muted-foreground">
                  Инструктор указал ETA ~{instructorEtaMinutes ?? "—"} мин. До встречи осталось:
                </p>
                <div
                  className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-300"
                  aria-live="polite"
                  aria-atomic="true"
                  data-eta-countdown="live"
                >
                  {formatCountdownMmSs(arrivalSecondsLeft)}
                </div>
                <p className="text-xs text-muted-foreground">
                  ({formatArrivalCountdownRu(arrivalSecondsLeft)})
                  {arrivalSecondsLeft === 0
                    ? " · ожидаем инструктора у точки встречи — напишите в чат, если задержка"
                    : null}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Загрузка таймера…</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {status === "PENDING_INSTRUCTOR" && routingQueue && routingQueue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {o.flexibleInstructorInvite
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
                  Заявка на сегодня у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Ответ{" "}
                  <strong>без таймера 60 с</strong> — он уведомлён и может принять, когда будет готов.
                </p>
              ) : multiDay ? (
                <p className="text-muted-foreground">
                  Заявка на несколько дней у выбранного инструктора: ответ <strong>без таймера 60 с</strong>, без
                  срочного ETA до встречи — согласование по датам и времени в чате или при встрече.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Ответ без ограничения по
                  времени.
                </p>
              )
            ) : (
              <p className="text-muted-foreground">
                Заявка отправлена выбранному инструктору <strong>{o.instructor?.name ?? "—"}</strong>. У него{" "}
                <strong>60 секунд</strong>, чтобы принять её. Если время истекает или он отклоняет заявку, заказ
                закрывается; при оплате оформляется полный возврат — к другим инструкторам заявка не передаётся.
              </p>
            )}
            {!relaxedTiming && pendingExpiresMs != null ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-medium text-amber-800 dark:text-amber-200">
                Ожидание ответа текущего инструктора:{" "}
                <span className="font-mono tabular-nums">{formatCountdownMmSs(secondsLeft ?? 0)}</span>
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
              {o.flexibleInstructorInvite
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
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Ответ без таймера — он
                  уведомлён и сможет принять заявку позже.
                </p>
              ) : lessonToday ? (
                <p className="text-muted-foreground">
                  Заявка на сегодня у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Ответ без таймера
                  60 с — он уведомлён и может принять, когда будет готов.
                </p>
              ) : multiDay ? (
                <p className="text-muted-foreground">
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong> на несколько дней. Ответ без
                  таймера 60 с; срочный ETA до встречи не требуется.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Ответ без ограничения по
                  времени.
                </p>
              )
            ) : (
              <p className="text-muted-foreground">
                Заявка только у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. На ответ — до{" "}
                <strong>60 секунд</strong>; иначе заказ закрывается с полным возвратом, другим не передаётся.
              </p>
            )}
            {!relaxedTiming && pendingExpiresMs != null ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-medium text-amber-800 dark:text-amber-200">
                Осталось:{" "}
                <span className="font-mono tabular-nums">{formatCountdownMmSs(secondsLeft ?? 0)}</span>
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
            {o.paymentStatus === "PENDING" && o.amountTotal ? (
              <Button type="button" variant="accent" disabled={payStripe.isPending} onClick={() => payStripe.mutate()}>
                Оплатить и отправить заявку
              </Button>
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
            Инструктор: <span className="font-medium">{o.instructor?.name ?? "—"}</span>
          </div>
          <div>
            Дисциплина: <span className="font-medium">{discipline}</span>
          </div>
          <div>
            Место встречи:{" "}
            <span className="font-medium">{meetPlace ?? "—"}</span>
          </div>
          <div>Сумма: {o.amountTotal ? `${Number(o.amountTotal)} ₽` : "—"}</div>
          <div>
            Оплата: <span className="font-medium">{clientPaymentStatusLabel(o.paymentStatus)}</span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span>
              Время:{" "}
              <span className="font-medium">
                {new Date(o.createdAt).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </span>
            {lessonStartMs != null && meetCountdownSecondsLeft != null ? (
              <span
                className="font-mono tabular-nums text-foreground"
                aria-live="polite"
                aria-atomic="true"
              >
                до встречи{" "}
                {meetCountdownSecondsLeft > 0
                  ? formatArrivalCountdownRu(meetCountdownSecondsLeft)
                  : "встреча прошла"}
              </span>
            ) : null}
          </div>
          {o.requestedStartDate ? (
            <div>
              Период занятий:{" "}
              <span className="font-medium">
                {new Date(o.requestedStartDate).toLocaleDateString("ru-RU")}
                {o.requestedEndDate &&
                new Date(o.requestedEndDate).toDateString() !==
                  new Date(o.requestedStartDate).toDateString()
                  ? ` — ${new Date(o.requestedEndDate).toLocaleDateString("ru-RU")}`
                  : null}
                {o.requestedDays != null && o.requestedDays > 1 ? ` (${o.requestedDays} дн.)` : null}
              </span>
            </div>
          ) : null}
          {instructorEtaMinutes != null ? <div>ETA: ~{instructorEtaMinutes} мин</div> : null}
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
            <Button type="button" variant="accent" onClick={() => payStripe.mutate()}>
              Оплатить картой (Stripe)
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
            <Button type="button" variant="accent" onClick={() => payStripe.mutate()}>
              Оплатить картой (Stripe)
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
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const r = await fetch(`/api/orders/${id}`);
      if (!r.ok) throw new Error("order");
      return r.json() as Promise<OrderPayload>;
    },
    refetchInterval: devPollInterval(5000),
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

  const payStripe = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      });
      const raw = await r.text();
      const j = (() => {
        try {
          return (raw ? JSON.parse(raw) : {}) as { url?: string; error?: unknown };
        } catch {
          return {} as { url?: string; error?: unknown };
        }
      })();
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "stripe");
      if (!j.url) throw new Error("Не удалось создать ссылку оплаты");
      window.location.href = j.url;
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка оплаты"),
  });

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
      mutations={{ patch, removeFromHistory, payStripe }}
    />
  );
}
