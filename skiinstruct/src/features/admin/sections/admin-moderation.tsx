"use client";

import { useEffect, useState } from "react";

import { AdminDeleteUserButton } from "@/features/admin/admin-delete-user-button";
import { AdminInstructorModerationSheet } from "@/features/admin/admin-instructor-moderation-sheet";
import type { AdminOverview } from "@/features/admin/admin-overview-types";
import {
  useAdminProfileReviewMutation,
  useAdminVerifyInstructorMutation,
} from "@/features/admin/use-admin-overview";
import { formatRussianPhoneDisplay } from "@/lib/phone";
import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

type ProfileChange = NonNullable<AdminOverview["pendingList"][number]["profileChanges"]>[number];
type PendingItem = AdminOverview["pendingList"][number];

type RejectTarget = {
  userId: string;
  moderationKind: PendingItem["moderationKind"];
  name: string | null;
  email: string;
};

function formatAdminPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return "не указан";
  return formatRussianPhoneDisplay(phone);
}

function profileChangeKindLabel(kind: ProfileChange["kind"]): string {
  switch (kind) {
    case "added":
      return "Добавлено";
    case "removed":
      return "Удалено";
    default:
      return "Изменено";
  }
}

function ProfileDraftChangesList({ changes }: { changes: ProfileChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="mt-2 w-full space-y-1.5 rounded-md border border-border/80 bg-muted/30 p-2">
      <p className="text-xs font-medium text-foreground">Изменения в анкете</p>
      <ul className="space-y-1.5">
        {changes.map((c) => (
          <li key={c.field} className="text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-foreground">{c.label}</span>
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  c.kind === "added" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                  c.kind === "removed" && "bg-destructive/15 text-destructive",
                  c.kind === "changed" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
                )}
              >
                {profileChangeKindLabel(c.kind)}
              </span>
            </div>
            {c.kind === "added" ? (
              <p className="mt-0.5 text-muted-foreground">
                <span className="text-foreground">{c.after ?? "—"}</span>
              </p>
            ) : c.kind === "removed" ? (
              <p className="mt-0.5 text-muted-foreground line-through">{c.before ?? "—"}</p>
            ) : (
              <p className="mt-0.5 text-muted-foreground">
                <span className="line-through opacity-70">{c.before ?? "—"}</span>
                <span className="mx-1 text-foreground">→</span>
                <span className="text-foreground">{c.after ?? "—"}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModerationRejectModal({
  target,
  pending,
  onClose,
  onSubmit,
}: {
  target: RejectTarget;
  pending: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const isNewAccount = target.moderationKind === "NEW_ACCOUNT";
  const title = isNewAccount ? "Отклонить регистрацию инструктора" : "Отклонить изменения анкеты";

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-modal-title"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reject-modal-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {target.name ?? "—"} · {target.email}
        </p>
        <p className="mt-2 text-sm text-foreground">
          Напишите инструктору, что нужно исправить. Без комментария отклонить нельзя.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="reject-message-modal" className="text-sm">
            Ответ инструктору <span className="text-destructive">*</span>
          </Label>
          <textarea
            id="reject-message-modal"
            autoFocus
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              isNewAccount
                ? "Например: укажите категорию и корректное описание опыта…"
                : "Например: уберите контакты и рекламу из достижений, укажите реальные длительности занятий…"
            }
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">Минимум 3 символа</p>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Закрыть
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || message.trim().length < 3}
            onClick={() => onSubmit(message.trim())}
          >
            Отправить отказ
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfileDraftChangesSummary({ changes }: { changes: ProfileChange[] }) {
  if (!changes.length) return null;
  const first = changes.slice(0, 4).map((c) => c.label);
  const hidden = Math.max(0, changes.length - first.length);
  return (
    <p className="mt-1 text-xs text-foreground">
      <span className="font-medium">Изменено:</span> {first.join(", ")}
      {hidden > 0 ? ` и ещё ${hidden}` : ""}.
    </p>
  );
}

export function AdminModerationSection({ data }: { data: AdminOverview }) {
  const verify = useAdminVerifyInstructorMutation();
  const profileReview = useAdminProfileReviewMutation();
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [dossierUserId, setDossierUserId] = useState<string | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Модерация анкет инструкторов</CardTitle>
          <p className="text-sm text-muted-foreground">
            В очереди: {data.pendingList.length}
            {data.pendingInstructors > data.pendingList.length
              ? ` (показаны первые ${data.pendingList.length} из ${data.pendingInstructors})`
              : null}
            . Для новой регистрации откройте окно подтверждения — там ФИО, паспорт, ИНН, документы и чеклист допуска к
            оплате (НПД/ЕГРИП).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.pendingList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Очередь пуста</p>
          ) : (
            <ul className="space-y-3">
              {data.pendingList.map((p) => (
                <li
                  key={`${p.userId}-${p.moderationKind}`}
                  className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.nickname || p.name || "—"}</div>
                    {p.legalName ? (
                      <div className="text-xs text-muted-foreground">ФИО: {p.legalName}</div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Телефон: {formatAdminPhone(p.phone)}
                      {p.moderationKind === "NEW_ACCOUNT" ? (
                        <>
                          <span aria-hidden> · </span>
                          ИНН: {p.inn?.trim() || "не указан"}
                        </>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.moderationKind === "NEW_ACCOUNT"
                        ? "Новая регистрация — первая проверка"
                        : "Изменения опубликованной анкеты"}
                      {p.profileDraftSubmittedAt
                        ? ` · ${formatInAppTimeZone(p.profileDraftSubmittedAt)}`
                        : null}
                    </p>
                    {p.acquisitionSource ? (
                      <p className={p.acquisitionRestricted ? "text-xs text-destructive" : "text-xs text-accent"}>
                        Источник: {p.acquisitionSource}
                      </p>
                    ) : null}
                    <div className="text-xs">{p.certificationLevel}</div>
                    {p.moderationKind === "PROFILE_UPDATE" ? (
                      <ProfileDraftChangesSummary changes={p.profileChanges ?? []} />
                    ) : null}
                    {p.moderationKind === "PROFILE_UPDATE" && p.profileChanges?.length ? (
                      <ProfileDraftChangesList changes={p.profileChanges} />
                    ) : p.moderationKind === "PROFILE_UPDATE" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Список изменений пуст (черновик совпадает с опубликованной анкетой).
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <AdminDeleteUserButton
                      userId={p.userId}
                      email={p.email}
                      name={p.name}
                      role="INSTRUCTOR"
                      disabled={
                        verify.isPending ||
                        profileReview.isPending ||
                        Boolean(rejectTarget) ||
                        Boolean(dossierUserId)
                      }
                    />
                    {p.moderationKind === "NEW_ACCOUNT" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="accent"
                          disabled={Boolean(rejectTarget) || Boolean(dossierUserId)}
                          onClick={() => setDossierUserId(p.userId)}
                        >
                          Проверить и подтвердить…
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={verify.isPending || Boolean(rejectTarget) || Boolean(dossierUserId)}
                          onClick={() =>
                            setRejectTarget({
                              userId: p.userId,
                              moderationKind: p.moderationKind,
                              name: p.name,
                              email: p.email,
                            })
                          }
                        >
                          Отклонить…
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(rejectTarget) || Boolean(dossierUserId)}
                          onClick={() => setDossierUserId(p.userId)}
                        >
                          Досье / договор
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="accent"
                          disabled={profileReview.isPending || Boolean(rejectTarget) || Boolean(dossierUserId)}
                          onClick={() => profileReview.mutate({ userId: p.userId, action: "approve" })}
                        >
                          Опубликовать изменения
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={profileReview.isPending || Boolean(rejectTarget) || Boolean(dossierUserId)}
                          onClick={() =>
                            setRejectTarget({
                              userId: p.userId,
                              moderationKind: p.moderationKind,
                              name: p.name,
                              email: p.email,
                            })
                          }
                        >
                          Отклонить изменения…
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {rejectTarget ? (
        <ModerationRejectModal
          target={rejectTarget}
          pending={verify.isPending || profileReview.isPending}
          onClose={() => setRejectTarget(null)}
          onSubmit={(rejectMessage) => {
            if (rejectTarget.moderationKind === "NEW_ACCOUNT") {
              verify.mutate(
                { userId: rejectTarget.userId, status: "REJECTED", rejectMessage },
                { onSuccess: () => setRejectTarget(null) },
              );
              return;
            }
            profileReview.mutate(
              { userId: rejectTarget.userId, action: "reject", rejectMessage },
              { onSuccess: () => setRejectTarget(null) },
            );
          }}
        />
      ) : null}

      {dossierUserId ? (
        <AdminInstructorModerationSheet
          userId={dossierUserId}
          onClose={() => setDossierUserId(null)}
          onRejected={() => setDossierUserId(null)}
        />
      ) : null}
    </>
  );
}
