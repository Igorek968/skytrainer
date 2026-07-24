"use client";

import Link from "next/link";
import { useState } from "react";

import {
  useAdminAgencyRegistry,
  useAdminComplianceReviewMutation,
  useAdminPendingCompliance,
} from "@/features/admin/use-admin-compliance";
import { AdminQualityClaimsSection } from "@/features/admin/sections/admin-quality-claims";
import { AdminYookassaExportCard } from "@/features/admin/admin-yookassa-export-card";
import { complianceDocTypeLabel } from "@/lib/instructor-agency-registry";
import { LEGAL_ROUTES } from "@/lib/legal";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return formatInAppTimeZone(iso, { dateStyle: "short", timeStyle: "short" });
}

export function AdminComplianceSection() {
  const [activeOnly, setActiveOnly] = useState(false);
  const [rejectDoc, setRejectDoc] = useState<{ userId: string; documentId: string; label: string } | null>(
    null,
  );
  const [rejectNote, setRejectNote] = useState("");

  const registry = useAdminAgencyRegistry(activeOnly);
  const pending = useAdminPendingCompliance();
  const review = useAdminComplianceReviewMutation();

  const rows = registry.data?.rows ?? [];
  const pendingItems = pending.data?.items ?? [];

  return (
    <div className="space-y-6">
      <AdminQualityClaimsSection />
      <AdminYookassaExportCard />

      <Card>
        <CardHeader>
          <CardTitle>Документы для проверяющих</CardTitle>
          <CardDescription>
            Публичная оферта агентского договора и реквизиты агента — для приложения к пакету документов.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={LEGAL_ROUTES.ofertaInstructor} target="_blank" rel="noopener noreferrer">
              Агентский договор (оферта)
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={LEGAL_ROUTES.requisites} target="_blank" rel="noopener noreferrer">
              Реквизиты агента
            </Link>
          </Button>
          <Button type="button" variant="secondary" size="sm" asChild>
            <a href="/api/admin/agency-registry?format=csv" download>
              Скачать реестр (CSV)
            </a>
          </Button>
          <Button type="button" variant="secondary" size="sm" asChild>
            <a href="/api/admin/agency-registry?activeOnly=1&format=csv" download>
              CSV — только с полным допуском
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Очередь документов НПД/ИП и страхования</CardTitle>
          <CardDescription>
            Без одобрения инструктор не может выйти «онлайн» и принять оплаченную заявку.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : pendingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет документов на проверке</p>
          ) : (
            <ul className="space-y-3">
              {pendingItems.map((item) => {
                const href = publicUploadDisplaySrc(item.fileUrl);
                return (
                  <li
                    key={item.documentId}
                    className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{item.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                      <p className="mt-1 text-sm">
                        {complianceDocTypeLabel(item.type)}
                        {item.inn ? ` · ИНН ${item.inn}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">Загружено: {formatDt(item.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {href ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={href} target="_blank" rel="noopener noreferrer">
                            Открыть файл
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="accent"
                        disabled={review.isPending}
                        onClick={() =>
                          review.mutate({
                            userId: item.userId,
                            documentId: item.documentId,
                            status: "APPROVED",
                          })
                        }
                      >
                        Одобрить
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={review.isPending}
                        onClick={() =>
                          setRejectDoc({
                            userId: item.userId,
                            documentId: item.documentId,
                            label: complianceDocTypeLabel(item.type),
                          })
                        }
                      >
                        Отклонить…
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Реестр акцептов агентского договора</CardTitle>
            <CardDescription>
              Инструкторы платформы: акцепт оферты, документы и факт работы. Всего: {rows.length}
            </CardDescription>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Только с полным допуском
          </label>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {registry.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет инструкторов</p>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Инструктор</th>
                  <th className="py-2 pr-3 font-medium">ИНН</th>
                  <th className="py-2 pr-3 font-medium">Акцепт оферты</th>
                  <th className="py-2 pr-3 font-medium">НПД/ИП</th>
                  <th className="py-2 pr-3 font-medium">Страх.</th>
                  <th className="py-2 pr-3 font-medium">Допуск</th>
                  <th className="py-2 pr-3 font-medium">Занятий</th>
                  <th className="py-2 font-medium">Справка</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                      <div className="text-xs text-muted-foreground">
                        анкета: {r.verificationStatus}
                        {r.isOnline ? " · онлайн" : ""}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{r.inn ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <div>{formatDt(r.agencyOfferAcceptedAt)}</div>
                      <div className="text-xs text-muted-foreground">v{r.agencyOfferVersion ?? "—"}</div>
                    </td>
                    <td className="py-2 pr-3">{r.taxDocumentApproved ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">{r.insuranceApproved ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">
                      {r.canAcceptPaidOrders ? (
                        <span className="text-emerald-700 dark:text-emerald-400">да</span>
                      ) : (
                        <span className="text-muted-foreground">нет</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {r.completedLessons}
                      <span className="text-xs text-muted-foreground"> / опл. {r.paidOrders}</span>
                    </td>
                    <td className="py-2">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link
                          href={`/api/admin/agency-registry/${r.userId}/certificate`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          PDF/печать
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {rejectDoc ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!review.isPending) setRejectDoc(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-border bg-background p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Отклонить документ</h2>
            <p className="mt-1 text-sm text-muted-foreground">{rejectDoc.label}</p>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="reject-compliance-note">Комментарий инструктору</Label>
              <textarea
                id="reject-compliance-note"
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={review.isPending}
                onClick={() => {
                  setRejectDoc(null);
                  setRejectNote("");
                }}
              >
                Отмена
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={review.isPending}
                onClick={() => {
                  review.mutate(
                    {
                      userId: rejectDoc.userId,
                      documentId: rejectDoc.documentId,
                      status: "REJECTED",
                      rejectNote: rejectNote.trim() || undefined,
                    },
                    {
                      onSuccess: () => {
                        setRejectDoc(null);
                        setRejectNote("");
                      },
                    },
                  );
                }}
              >
                Отклонить
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
