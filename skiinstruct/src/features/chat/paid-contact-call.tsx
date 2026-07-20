"use client";

import { Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { PaidContactDTO } from "@/lib/services/paid-contact";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Endpoint, возвращающий { contact, hint?, error? }. */
  contactUrl: string;
  /** Подпись кнопки до раскрытия. */
  label?: string;
  className?: string;
  /** Компактный вид рядом с чатом. */
  size?: "sm" | "default";
};

/**
 * «Позвонить»: номер запрашивается только по клику (не лежит в HTML страницы).
 * После раскрытия — tel: и отображение для копирования.
 */
export function PaidContactCallButton({
  contactUrl,
  label = "Позвонить",
  className,
  size = "sm",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState<PaidContactDTO | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function reveal() {
    if (contact) {
      window.location.href = contact.telHref;
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(contactUrl, { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as {
        contact?: PaidContactDTO | null;
        hint?: string;
        error?: string;
      };
      if (!r.ok || !j.contact) {
        throw new Error(typeof j.error === "string" ? j.error : "Контакт недоступен");
      }
      setContact(j.contact);
      setHint(j.hint ?? null);
      window.location.href = j.contact.telHref;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось получить номер");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={loading}
        onClick={() => void reveal()}
        className="gap-1.5"
      >
        <Phone className="h-3.5 w-3.5" />
        {loading ? "…" : contact ? `Позвонить${contact.counterpartName ? ` · ${contact.counterpartName}` : ""}` : label}
      </Button>
      {contact ? (
        <p className="text-xs text-muted-foreground">
          <a href={contact.telHref} className="font-medium text-accent underline-offset-2 hover:underline">
            {contact.phoneDisplay}
          </a>
          {hint ? <span className="mt-0.5 block">{hint}</span> : null}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Номер откроется только вам после нажатия. Сначала удобнее написать в чат.
        </p>
      )}
    </div>
  );
}
