"use client";

import { LifeBuoy } from "lucide-react";

import { useSupportLauncher } from "@/features/support/support-provider";
import { YM_GOALS, trackYandexGoal } from "@/shared/analytics/yandex-metrika-client";
import { Button } from "@/shared/ui/button";

export function SupportLauncher({ className }: { className?: string }) {
  const { openSupport } = useSupportLauncher();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => {
        trackYandexGoal(YM_GOALS.supportOpen);
        openSupport();
      }}
      aria-haspopup="dialog"
    >
      <LifeBuoy className="mr-1.5 h-4 w-4" aria-hidden />
      Поддержка
    </Button>
  );
}
