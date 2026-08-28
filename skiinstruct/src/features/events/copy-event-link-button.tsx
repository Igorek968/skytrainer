"use client";

import { toast } from "sonner";

import { publicEventPath } from "@/lib/public-event";
import { Button } from "@/shared/ui/button";

export function CopyEventLinkButton({
  eventId,
  size = "sm",
  label = "Ссылка для рекламы",
}: {
  eventId: string;
  size?: "sm" | "default";
  label?: string;
}) {
  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      onClick={async () => {
        const url = `${window.location.origin}${publicEventPath(eventId)}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Ссылка скопирована — вставьте в объявление");
        } catch {
          toast.message(url);
        }
      }}
    >
      {label}
    </Button>
  );
}
