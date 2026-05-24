"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { LEGAL_ROUTES } from "@/lib/legal";
import { NPD_RECEIPT_DEADLINE_HOURS, PAYOUT_MIN_WITHDRAWAL_RUB } from "@/lib/legal-config";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type ComplianceDoc = {
  id: string;
  type: string;
  fileUrl: string;
  status: string;
  rejectNote: string | null;
};

type ComplianceStatus = {
  agencyOfferAccepted: boolean;
  taxDocumentApproved: boolean;
  insuranceApproved: boolean;
  canAcceptPaidOrders: boolean;
  documents: ComplianceDoc[];
};

export function InstructorComplianceCard() {
  const qc = useQueryClient();
  const taxInput = useRef<HTMLInputElement>(null);
  const insInput = useRef<HTMLInputElement>(null);
  const [taxStatus, setTaxStatus] = useState<"SELF_EMPLOYED" | "IP">("SELF_EMPLOYED");
  const [inn, setInn] = useState("");
  const [payoutHint, setPayoutHint] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["instructor-compliance"],
    queryFn: async () => {
      const res = await fetch("/api/instructor/compliance");
      if (!res.ok) throw new Error("load");
      return res.json() as Promise<ComplianceStatus>;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/instructor/compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxStatus,
          inn: inn.replace(/\D/g, ""),
          payoutAccountHint: payoutHint || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "save");
      }
    },
    onSuccess: () => {
      toast.success("Сохранено");
      void qc.invalidateQueries({ queryKey: ["instructor-compliance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("type", type);
      const res = await fetch("/api/instructor/compliance", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "upload");
      }
    },
    onSuccess: () => {
      toast.success("Документ отправлен на проверку");
      void qc.invalidateQueries({ queryKey: ["instructor-compliance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Соответствие и выплаты</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Загрузка…</CardContent>
      </Card>
    );
  }

  const taxType = taxStatus === "IP" ? "TAX_STATUS_IP" : "TAX_STATUS_NPD";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Соответствие и выплаты</CardTitle>
        <CardDescription>
          Для приёма оплаченных заявок: агентский договор, документы НПД/ИП, страхование. Минимальный вывод —{" "}
          {PAYOUT_MIN_WITHDRAWAL_RUB} ₽. Чек НПД — в течение {NPD_RECEIPT_DEADLINE_HOURS} ч после каждого урока.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="list-inside list-disc text-muted-foreground">
          <li>
            Агентский договор:{" "}
            {data.agencyOfferAccepted ? (
              <span className="text-foreground">принят</span>
            ) : (
              <Link className="text-accent underline" href={LEGAL_ROUTES.ofertaInstructor}>
                принять
              </Link>
            )}
          </li>
          <li>Налоговый статус: {data.taxDocumentApproved ? "одобрен" : "требуется загрузка"}</li>
          <li>Страхование: {data.insuranceApproved ? "одобрено" : "требуется загрузка"}</li>
          <li>
            Приём заявок:{" "}
            <span className="font-medium text-foreground">
              {data.canAcceptPaidOrders ? "разрешён" : "заблокирован до одобрения документов"}
            </span>
          </li>
        </ul>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Статус</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={taxStatus}
              onChange={(e) => setTaxStatus(e.target.value as "SELF_EMPLOYED" | "IP")}
            >
              <option value="SELF_EMPLOYED">Самозанятый (НПД)</option>
              <option value="IP">ИП</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inn">ИНН</Label>
            <Input id="inn" value={inn} onChange={(e) => setInn(e.target.value)} placeholder="10–12 цифр" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payout">Реквизиты для выплат (маска)</Label>
          <Input
            id="payout"
            value={payoutHint}
            onChange={(e) => setPayoutHint(e.target.value)}
            placeholder="Карта ···· 1234"
          />
        </div>
        <Button type="button" variant="outline" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
          Сохранить реквизиты
        </Button>

        <div className="flex flex-wrap gap-2">
          <input
            ref={taxInput}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate({ file: f, type: taxType });
              e.target.value = "";
            }}
          />
          <input
            ref={insInput}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate({ file: f, type: "INSURANCE" });
              e.target.value = "";
            }}
          />
          <Button type="button" variant="secondary" onClick={() => taxInput.current?.click()}>
            Загрузить НПД/ИП
          </Button>
          <Button type="button" variant="secondary" onClick={() => insInput.current?.click()}>
            Загрузить страховку
          </Button>
        </div>

        {data.documents.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {data.documents.slice(0, 8).map((d) => (
              <li key={d.id}>
                {d.type}: {d.status}
                {d.rejectNote ? ` — ${d.rejectNote}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
