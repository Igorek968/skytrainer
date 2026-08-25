"use client";

import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, type ComponentProps } from "react";

import { Button } from "@/shared/ui/button";
import {
  canUseWebShare,
  copyReferralLink,
  shareOrCopyReferralLink,
} from "@/features/share/share-referral";

type ShareReferralButtonProps = {
  referralLink: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  /** Показать отдельную кнопку «Копировать» рядом с «Поделиться». */
  showCopyButton?: boolean;
};

export function ShareReferralButton({
  referralLink,
  variant = "outline",
  size,
  className,
  showCopyButton = false,
}: ShareReferralButtonProps) {
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(canUseWebShare());
  }, []);

  async function onShare() {
    if (!referralLink) return;
    try {
      const result = await shareOrCopyReferralLink(referralLink);
      toast.success(
        result === "shared"
          ? "Ссылка отправлена"
          : "Ссылка скопирована — вставьте в чат или письмо",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Не удалось поделиться ссылкой");
    }
  }

  async function onCopy() {
    if (!referralLink) return;
    try {
      await copyReferralLink(referralLink);
      toast.success("Ссылка скопирована — вставьте в чат или письмо");
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <div className={className ? `flex flex-wrap gap-2 ${className}` : "flex flex-wrap gap-2"}>
      <Button type="button" variant={variant} size={size} onClick={() => void onShare()}>
        {canNativeShare ? (
          <Share2 className="mr-1.5 h-4 w-4" aria-hidden />
        ) : (
          <Copy className="mr-1.5 h-4 w-4" aria-hidden />
        )}
        {canNativeShare ? "Поделиться" : "Копировать ссылку"}
      </Button>
      {showCopyButton && canNativeShare ? (
        <Button type="button" variant="outline" size={size} onClick={() => void onCopy()}>
          <Copy className="mr-1.5 h-4 w-4" aria-hidden />
          Копировать
        </Button>
      ) : null}
    </div>
  );
}
