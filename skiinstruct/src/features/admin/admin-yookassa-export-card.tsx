"use client";

import { useState } from "react";
import { toast } from "sonner";

import { LEGAL_PLATFORM_URL } from "@/lib/legal-config";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

function packageUrl(params: {
  format: "zip" | "html" | "preview";
  activeOnly: boolean;
  noCertificates: boolean;
  noClientCertificates: boolean;
  allClients: boolean;
}) {
  const q = new URLSearchParams({ format: params.format });
  if (params.activeOnly) q.set("activeOnly", "1");
  if (params.noCertificates) q.set("noCertificates", "1");
  if (params.noClientCertificates) q.set("noClientCertificates", "1");
  if (params.allClients) q.set("allClients", "1");
  return `/api/admin/yookassa-package?${q.toString()}`;
}

async function downloadBlob(url: string, fallbackName: string) {
  const r = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Ошибка ${r.status}`);
  }
  const blob = await r.blob();
  const disposition = r.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}

export function AdminYookassaExportCard() {
  const [activeOnly, setActiveOnly] = useState(false);
  const [noCertificates, setNoCertificates] = useState(false);
  const [noClientCertificates, setNoClientCertificates] = useState(false);
  const [allClients, setAllClients] = useState(false);
  const [busy, setBusy] = useState<"zip" | "html" | null>(null);

  const opts = { activeOnly, noCertificates, noClientCertificates, allClients };

  async function onDownloadZip() {
    setBusy("zip");
    try {
      await downloadBlob(packageUrl({ ...opts, format: "zip" }), "yookassa-paket.zip");
      toast.success("ZIP скачан");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось скачать ZIP");
    } finally {
      setBusy(null);
    }
  }

  async function onDownloadHtml() {
    setBusy("html");
    try {
      await downloadBlob(packageUrl({ ...opts, format: "html" }), "yookassa-paket.html");
      toast.success("HTML скачан — откройте в браузере и сохраните как PDF");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось скачать HTML");
    } finally {
      setBusy(null);
    }
  }

  function onPreview() {
    window.open(packageUrl({ ...opts, format: "preview" }), "_blank", "noopener,noreferrer");
  }

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader>
        <CardTitle>Пакет документов для ЮKassa</CardTitle>
        <CardDescription>
          Скачайте на проде ({LEGAL_PLATFORM_URL}): сопроводительное письмо, оферты, реквизиты, реестры и
          заполненные договоры с инструкторами и клиентами. Данные из текущей базы.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            <span>Только инструкторы с полным допуском</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={noCertificates}
              onChange={(e) => setNoCertificates(e.target.checked)}
            />
            <span>Без договоров по каждому инструктору</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={noClientCertificates}
              onChange={(e) => setNoClientCertificates(e.target.checked)}
            />
            <span>Без договоров по каждому клиенту</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={allClients}
              onChange={(e) => setAllClients(e.target.checked)}
              disabled={noClientCertificates}
            />
            <span>Все клиенты (не только с оплатами)</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="accent"
            disabled={busy !== null}
            onClick={() => void onDownloadZip()}
          >
            {busy === "zip" ? "Собираем ZIP…" : "Скачать ZIP (весь пакет)"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void onDownloadHtml()}>
            {busy === "html" ? "Готовим HTML…" : "Скачать HTML"}
          </Button>
          <Button type="button" variant="outline" onClick={onPreview}>
            Открыть для печати в PDF
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/api/admin/agency-registry?format=csv" download>
              CSV инструкторов
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/api/admin/client-registry?paidOnly=1&format=csv" download>
              CSV клиентов
            </a>
          </Button>
        </div>

        <div className="rounded-md border border-border bg-background/80 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Как отправить в ЮKassa</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Скачайте ZIP или HTML.</li>
            <li>
              Файл <code className="text-foreground">yookassa-paket-*.html</code> → откройте → «Печать» → «Сохранить
              как PDF».
            </li>
            <li>Приложите PDF и CSV-реестры к обращению в поддержку.</li>
            <li>
              В тексте укажите: исполнители — инструкторы НПД/ИП по агентским договорам; с клиентами — договор
              бронирования услуг (оферта + акцепт); ООО «ТВОЙТРЕНЕР» — оператор платформы.
            </li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground">
          Нужен только просмотр без скачивания — «Открыть для печати». Если кнопки возвращают 401, войдите как
          администратор в этой же вкладке.
        </p>
      </CardContent>
    </Card>
  );
}
