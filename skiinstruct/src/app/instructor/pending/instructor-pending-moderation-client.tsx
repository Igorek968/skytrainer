"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState, Suspense } from "react";
import { toast } from "sonner";

import { isWebPushAvailable, subscribeWebPush } from "@/features/push/web-push-client";
import {
  EmailVerificationGate,
  forceEmailVerificationGate,
} from "@/features/auth/email-verification-gate";
import { SupportLauncher } from "@/features/support/support-launcher";
import { signOutCallbackForRole } from "@/lib/auth-routes";
import {
  fireSiteAlert,
  siteAlertTitle,
  unlockSiteAlertSound,
} from "@/lib/site-alert";
import { readStoredUtm } from "@/shared/analytics/utm-capture";
import { YM_GOALS, trackYandexGoal } from "@/shared/analytics/yandex-metrika-client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

type MeSnapshot = {
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  profileDraftRejectNote: string | null;
};

async function fetchMe(): Promise<MeSnapshot> {
  const r = await fetch("/api/instructor/me", { credentials: "include" });
  if (!r.ok) throw new Error("me");
  const data = (await r.json()) as {
    verificationStatus?: MeSnapshot["verificationStatus"];
    profileDraftRejectNote?: string | null;
  };
  return {
    verificationStatus: data.verificationStatus ?? "PENDING",
    profileDraftRejectNote: data.profileDraftRejectNote ?? null,
  };
}

export function InstructorPendingModerationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const prevStatusRef = useRef<MeSnapshot["verificationStatus"] | null>(null);
  const [resubmitting, setResubmitting] = useState(false);

  const { data, isError } = useQuery({
    queryKey: ["instructor-pending-me"],
    queryFn: fetchMe,
    refetchInterval: (q) =>
      q.state.data?.verificationStatus === "PENDING" ? 8_000 : false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const unlock = () => unlockSiteAlertSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const appliedGoalSent = useRef(false);

  useEffect(() => {
    if (searchParams.get("applied") !== "1" || appliedGoalSent.current) return;
    appliedGoalSent.current = true;
    trackYandexGoal(YM_GOALS.instructorApplySuccess, readStoredUtm());

    // Цепочка: анкета → экран модерации → сразу стоп-окно email (не проскакивать)
    forceEmailVerificationGate();
    toast.message("Заявка принята", {
      description:
        "Сначала подтвердите email по письму. Затем дождитесь решения модератора — кабинет откроется после одобрения.",
      duration: 8_000,
    });
    router.replace("/instructor/pending?verifyEmail=1", { scroll: false });
  }, [router, searchParams]);

  // На каждом заходе на pending без подтверждённой почты — держим замок
  useEffect(() => {
    if (searchParams.get("emailVerified") === "1") return;
    if (searchParams.get("verifyEmail") === "1") {
      forceEmailVerificationGate();
    }
  }, [searchParams]);

  useEffect(() => {
    if (!data?.verificationStatus) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = data.verificationStatus;
    if (prev === null) {
      if (data.verificationStatus === "APPROVED") {
        router.replace("/instructor");
      }
      return;
    }

    if (prev === "PENDING" && data.verificationStatus === "APPROVED") {
      fireSiteAlert({
        title: siteAlertTitle("Заявка одобрена"),
        body: "Модерация пройдена. Открываем кабинет инструктора.",
        sound: "order",
        tag: "instructor-verification-approved",
        url: "/instructor",
        requireInteraction: true,
        toastAction: {
          label: "В кабинет",
          onClick: () => {
            window.location.href = "/instructor";
          },
        },
      });
      router.replace("/instructor");
      return;
    }

    if (prev === "PENDING" && data.verificationStatus === "REJECTED") {
      fireSiteAlert({
        title: siteAlertTitle("Заявка отклонена"),
        body:
          data.profileDraftRejectNote?.trim() ||
          "Администратор отклонил заявку. Смотрите комментарий на этой странице.",
        sound: "reminder",
        tag: "instructor-verification-rejected",
        url: "/instructor/pending",
        requireInteraction: true,
      });
    }
  }, [data?.verificationStatus, data?.profileDraftRejectNote, router]);

  async function enableAlerts() {
    unlockSiteAlertSound();
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => {});
    }
    const ok = isWebPushAvailable() ? await subscribeWebPush() : false;
    if (ok) {
      toast.success("Уведомления включены — сообщим о решении модерации");
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      toast.error("Разрешите уведомления в настройках браузера");
    } else {
      toast.message("Разрешите уведомления, чтобы получить сигнал о модерации");
    }
  }

  async function resubmit() {
    setResubmitting(true);
    try {
      const r = await fetch("/api/instructor/resubmit-verification", {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => null)) as { error?: string } | null;
        toast.error(err?.error ?? "Не удалось отправить повторно");
        return;
      }
      toast.success("Заявка снова в очереди на модерацию");
      await qc.invalidateQueries({ queryKey: ["instructor-pending-me"] });
    } finally {
      setResubmitting(false);
    }
  }

  const status = data?.verificationStatus ?? "PENDING";
  const rejectNote = data?.profileDraftRejectNote?.trim();

  return (
    <div className="mx-auto max-w-lg space-y-6 py-2">
      <Suspense fallback={null}>
        <EmailVerificationGate role="INSTRUCTOR" />
      </Suspense>
      <Card>
        <CardHeader>
          <CardTitle as="h1">
            {status === "REJECTED" ? "Заявка отклонена" : "Ожидание подтверждения"}
          </CardTitle>
          <CardDescription>
            {status === "REJECTED"
              ? "Администратор отклонил регистрацию. Исправьте анкету и отправьте снова — или напишите в поддержку."
              : "Анкета на модерации. Кабинет инструктора откроется только после одобрения администратором."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError ? (
            <p className="text-sm text-destructive">Не удалось загрузить статус. Обновите страницу.</p>
          ) : null}

          {status === "PENDING" ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Статус: на модерации. Обычно проверка занимает немного времени — страница обновится сама.
            </div>
          ) : null}

          {status === "REJECTED" && rejectNote ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">
              <p className="font-medium text-foreground">Комментарий администратора</p>
              <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{rejectNote}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" onClick={() => void enableAlerts()}>
              Включить оповещение о модерации
            </Button>
            {status === "REJECTED" ? (
              <>
                <Button type="button" variant="accent" asChild>
                  <Link href="/instructor/pending/edit">Вернуться в анкету</Link>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={resubmitting}
                  onClick={() => void resubmit()}
                >
                  {resubmitting ? "Отправка…" : "Отправить повторно без правок"}
                </Button>
              </>
            ) : null}
            <SupportLauncher className="sm:ml-auto" />
          </div>

          <p className="text-xs text-muted-foreground">
            Включите оповещения, чтобы получить звуковой сигнал и уведомление, когда администратор примет решение —
            даже если вкладка свёрнута.
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void signOut({ callbackUrl: signOutCallbackForRole("INSTRUCTOR") })}
          >
            Выйти
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
