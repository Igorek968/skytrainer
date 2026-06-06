"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { NPD_RECEIPT_DEADLINE_HOURS } from "@/lib/legal-config";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { Button } from "@/shared/ui/button";

export function NpdReceiptUpload({
  orderId,
  existingUrl,
  onUploaded,
}: {
  orderId: string;
  existingUrl?: string | null;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  if (existingUrl) {
    const href = publicUploadDisplaySrc(existingUrl) ?? existingUrl;
    return (
      <p className="text-sm text-muted-foreground">
        Чек загружен:{" "}
        <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">
          открыть
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">
        Загрузите чек из «Мой налог» в течение {NPD_RECEIPT_DEADLINE_HOURS} ч после занятия (агентский договор).
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setLoading(true);
          try {
            const fd = new FormData();
            fd.set("file", file);
            const res = await fetch(`/api/orders/${orderId}/npd-receipt`, { method: "POST", body: fd });
            const j = await res.json();
            if (!res.ok) {
              toast.error(j.error ?? "Не удалось загрузить");
              return;
            }
            toast.success("Чек загружен");
            onUploaded();
          } catch {
            toast.error("Ошибка сети");
          } finally {
            setLoading(false);
            e.target.value = "";
          }
        }}
      />
      <Button type="button" variant="secondary" disabled={loading} onClick={() => inputRef.current?.click()}>
        {loading ? "Загрузка…" : "Загрузить чек НПД"}
      </Button>
    </div>
  );
}
