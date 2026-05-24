"use client";

import { LifeBuoy } from "lucide-react";

import { useSupportLauncher } from "@/features/support/support-provider";
import { Button } from "@/shared/ui/button";

export function SupportLauncher({ className }: { className?: string }) {
  const { openSupport } = useSupportLauncher();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={openSupport}
      aria-haspopup="dialog"
    >
      <LifeBuoy className="mr-1.5 h-4 w-4" aria-hidden />
      Поддержка
    </Button>
  );
}
