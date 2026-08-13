"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { InstructorModerationDossier } from "@/lib/instructor-moderation-dossier";
import { formatRussianPhoneDisplay } from "@/lib/phone";
import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  onClose: () => void;
  onRejected?: () => void;
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{value?.trim() || "—"}</dd>
    </div>
  );
}

function statusBadge(status: string) {
  if (status === "APPROVED") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (status === "REJECTED") return "bg-destructive/15 text-destructive";
  return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
}

export function AdminInstructorModerationSheet({ userId, onClose, onRejected }: Props) {
  const qc = useQueryClient();
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");

  const dossier = useQuery({
    queryKey: ["admin-instructor-moderation", userId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/instructors/${userId}/moderation`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Не удалось загрузить досье");
      }
      return r.json() as Promise<InstructorModerationDossier>;
    },
  });

  useEffect(() => {
    if (!dossier.data) return;
    setSelectedDocs(new Set(dossier.data.pendingDocumentIds));
  }, [dossier.data]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const verify = useMutation({
    mutationFn: async (body: {
      status: "APPROVED" | "REJECTED";
      rejectMessage?: string;
      approveDocumentIds?: string[];
    }) => {
      const r = await fetch(`/api/admin/instructors/${userId}/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string | object };
      if (!r.ok) {
        const err =
          typeof j.error === "string"
            ? j.error
            : "Не удалось сохранить решение";
        throw new Error(err);
      }
      return j;
    },
    onSuccess: async (_data, vars) => {
      toast.success(vars.status === "APPROVED" ? "Анкета одобрена" : "Регистрация отклонена");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-overview"] }),
        qc.invalidateQueries({ queryKey: ["admin-agency-registry"] }),
        qc.invalidateQueries({ queryKey: ["admin-compliance-pending"] }),
        qc.invalidateQueries({ queryKey: ["admin-instructors-funnel"] }),
        qc.invalidateQueries({ queryKey: ["admin-alerts"] }),
        qc.invalidateQueries({ queryKey: ["admin-instructor-moderation", userId] }),
      ]);
      if (vars.status === "REJECTED") onRejected?.();
      else onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Одобрить уже загруженные документы, когда анкета уже APPROVED. */
  const reviewDocs = useMutation({
    mutationFn: async (docs: { id: string; label: string }[]) => {
      for (const d of docs) {
        const r = await fetch(`/api/admin/instructors/${userId}/compliance`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: d.id, status: "APPROVED" }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? `Не удалось одобрить: ${d.label}`);
      }
    },
    onSuccess: async () => {
      toast.success("Документы одобрены");
      setSelectedDocs(new Set());
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-instructor-moderation", userId] }),
        qc.invalidateQueries({ queryKey: ["admin-compliance-pending"] }),
        qc.invalidateQueries({ queryKey: ["admin-instructors-funnel"] }),
        qc.invalidateQueries({ queryKey: ["admin-agency-registry"] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const docToggle = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const data = dossier.data;
  const taxPending = useMemo(
    () =>
      data?.documents.find(
        (d) =>
          d.status === "PENDING" &&
          (d.type === "TAX_STATUS_NPD" || d.type === "TAX_STATUS_IP"),
      ) ?? null,
    [data],
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-sheet-title"
      onClick={() => {
        if (!verify.isPending) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-border bg-background shadow-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="moderation-sheet-title" className="text-lg font-semibold">
              {data?.moderationKind === "NEW_ACCOUNT"
                ? "Подтверждение анкеты инструктора"
                : "Профиль инструктора"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Все данные, паспорт и документы НПД/ЕГРИП — в одном окне
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={verify.isPending} onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {dossier.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка досье…</p>
          ) : dossier.isError || !data ? (
            <p className="text-sm text-destructive">
              {(dossier.error as Error | null)?.message ?? "Ошибка загрузки"}
            </p>
          ) : (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Сторона договора (принципал)</h3>
                <dl className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
                  <Field label="ФИО" value={data.contract.fullName} />
                  <Field label="Никнейм" value={data.contract.nickname} />
                  <Field label="Email" value={data.contract.email} />
                  <Field
                    label="Телефон"
                    value={
                      data.contract.phone
                        ? formatRussianPhoneDisplay(data.contract.phone)
                        : null
                    }
                  />
                  <Field label="Дата рождения" value={data.contract.birthDate} />
                  <Field label="ИНН" value={data.contract.inn} />
                  <Field label="Налоговый статус" value={data.contract.taxStatusLabel} />
                  <Field
                    label="Акцепт оферты"
                    value={
                      data.contract.agencyOfferAcceptedAt
                        ? `${formatInAppTimeZone(data.contract.agencyOfferAcceptedAt)} · v${data.contract.agencyOfferVersion ?? "—"}`
                        : null
                    }
                  />
                </dl>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Паспорт РФ</h3>
                <dl className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
                  <Field label="Серия" value={data.contract.passportSeries} />
                  <Field label="Номер" value={data.contract.passportNumber} />
                  <Field label="Дата выдачи" value={data.contract.passportIssuedAt} />
                  <Field label="Код подразделения" value={data.contract.passportDepartmentCode} />
                </dl>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Профиль на площадке</h3>
                <dl className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
                  <Field
                    label="Направления"
                    value={data.profile.specializations.join(", ") || null}
                  />
                  <Field
                    label="Ставка"
                    value={
                      data.profile.hourlyRate != null
                        ? `${data.profile.hourlyRate.toLocaleString("ru-RU")} ₽/ч`
                        : null
                    }
                  />
                  <div className="sm:col-span-2">
                    <Field label="О себе" value={data.profile.bio} />
                  </div>
                  <Field label="Источник заявки" value={data.acquisitionSource} />
                  <Field
                    label="Реквизиты выплат (маска)"
                    value={data.contract.payoutAccountHint}
                  />
                </dl>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Допуск к оплаченным заявкам</h3>
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p>
                    Статус:{" "}
                    <span
                      className={cn(
                        "font-medium",
                        data.compliance.canAcceptPaidOrders
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-amber-800 dark:text-amber-300",
                      )}
                    >
                      {data.compliance.canAcceptPaidOrders
                        ? "можно принимать оплату"
                        : "пока нельзя принимать оплату"}
                    </span>
                  </p>
                  <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                    <li>Оферта: {data.compliance.agencyOfferAccepted ? "да" : "нет"}</li>
                    <li>
                      НПД/ЕГРИП от модератора:{" "}
                      {data.compliance.taxDocumentApproved ? "одобрено" : "нужно подтверждение"}
                    </li>
                    <li>Паспорт: {data.compliance.passportApproved ? "одобрен" : "ожидает"}</li>
                    <li>
                      Страхование:{" "}
                      {data.compliance.insuranceApproved
                        ? "загружено"
                        : "необязательно (не блокирует выплаты)"}
                    </li>
                  </ul>
                  {data.compliance.blockers.length > 0 ? (
                    <div className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                      <p className="font-medium">Чтобы открыть оплату клиентам:</p>
                      <ul className="mt-1 list-inside list-disc">
                        {data.compliance.blockers.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {!taxPending && !data.compliance.taxDocumentApproved ? (
                    <p className="mt-2 text-xs text-destructive">
                      Справка «Мой налог» / выписка ЕГРИП ещё не загружена инструктором. Одобрить анкету можно, но
                      допуск к оплате откроется только после загрузки и вашего подтверждения документа.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Документы</h3>
                  <a
                    className="text-xs text-accent underline"
                    href={data.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть заполненный договор (HTML/PDF)
                  </a>
                </div>
                {data.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Документов пока нет</p>
                ) : (
                  <ul className="space-y-2">
                    {data.documents.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{d.typeLabel}</span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                                statusBadge(d.status),
                              )}
                            >
                              {d.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatInAppTimeZone(d.createdAt)}
                            {d.rejectNote ? ` · ${d.rejectNote}` : ""}
                          </p>
                          {d.viewUrl ? (
                            <a
                              className="text-xs text-accent underline"
                              href={d.viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Открыть файл
                            </a>
                          ) : d.fileMissing ? (
                            <p className="text-xs text-destructive">
                              Файл утерян на сервере (часто после деплоя). Попросите инструктора снова загрузить
                              документ: НПД/ЕГРИП — в анкете (правка после отказа), паспорт/страховку — в кабинете →
                              «Соответствие и выплаты».
                            </p>
                          ) : null}
                        </div>
                        {d.status === "PENDING" ? (
                          <label
                            className={cn(
                              "flex items-center gap-2 text-sm",
                              d.fileMissing && "cursor-not-allowed opacity-50",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={selectedDocs.has(d.id)}
                              disabled={Boolean(d.fileMissing) || reviewDocs.isPending}
                              onChange={() => docToggle(d.id)}
                            />
                            {data.moderationKind === "NEW_ACCOUNT"
                              ? "Одобрить вместе с анкетой"
                              : "Одобрить документ"}
                            {d.fileMissing ? " (сначала нужен файл)" : ""}
                          </label>
                        ) : null}
                        {d.status === "REJECTED" && !d.fileMissing ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={reviewDocs.isPending}
                            onClick={() =>
                              reviewDocs.mutate([{ id: d.id, label: d.typeLabel }])
                            }
                          >
                            Всё же одобрить
                          </Button>
                        ) : null}
                        {d.status === "REJECTED" && d.fileMissing ? (
                          <p className="text-xs text-muted-foreground">
                            Отклонён. Попросите инструктора загрузить новый скан.
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {rejectMode ? (
                <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <Label htmlFor="moderation-reject">Причина отказа инструктору</Label>
                  <textarea
                    id="moderation-reject"
                    className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={rejectMessage}
                    onChange={(e) => setRejectMessage(e.target.value)}
                    placeholder="Что исправить: паспорт, ИНН, фото, описание…"
                    maxLength={2000}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          {!rejectMode ? (
            <>
              {data?.moderationKind === "NEW_ACCOUNT" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={verify.isPending || !data}
                    onClick={() => setRejectMode(true)}
                  >
                    Отклонить…
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    disabled={verify.isPending || !data}
                    onClick={() =>
                      verify.mutate({
                        status: "APPROVED",
                        approveDocumentIds: [...selectedDocs],
                      })
                    }
                  >
                    {selectedDocs.size > 0
                      ? `Одобрить анкету + документы (${selectedDocs.size})`
                      : "Одобрить анкету"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="mr-auto text-xs text-muted-foreground">
                    Анкета уже одобрена — здесь можно только подтвердить документы.
                  </p>
                  <Button
                    type="button"
                    variant="accent"
                    disabled={
                      reviewDocs.isPending || !data || selectedDocs.size === 0
                    }
                    onClick={() => {
                      const docs =
                        data?.documents
                          .filter((d) => selectedDocs.has(d.id) && d.status === "PENDING")
                          .map((d) => ({ id: d.id, label: d.typeLabel })) ?? [];
                      if (docs.length) reviewDocs.mutate(docs);
                    }}
                  >
                    {reviewDocs.isPending
                      ? "Сохранение…"
                      : selectedDocs.size > 0
                        ? `Одобрить документы (${selectedDocs.size})`
                        : "Выберите документы галочками"}
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={verify.isPending}
                onClick={() => {
                  setRejectMode(false);
                  setRejectMessage("");
                }}
              >
                Назад
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={verify.isPending || rejectMessage.trim().length < 3}
                onClick={() =>
                  verify.mutate({
                    status: "REJECTED",
                    rejectMessage: rejectMessage.trim(),
                  })
                }
              >
                Отправить отказ
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
