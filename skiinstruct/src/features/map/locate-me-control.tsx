"use client";

import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";

export function LocateMeControl({ onLocate }: { onLocate: () => Promise<void> }) {
  const [locating, setLocating] = useState(false);

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000]">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="pointer-events-auto h-9 gap-1.5 shadow-md"
        disabled={locating}
        onClick={() => {
          setLocating(true);
          void onLocate()
            .then(() => toast.success("Ваше местоположение на карте"))
            .catch((err: unknown) => {
              const code = err instanceof Error ? err.message : "";
              if (code === "GEO_DENIED") {
                toast.error(
                  "Доступ к геолокации запрещён. В настройках браузера для этого сайта включите «Местоположение» и нажмите «Найти меня» снова.",
                );
              } else if (code === "GEO_UNSUPPORTED") {
                toast.error("Геолокация не поддерживается этим браузером");
              } else {
                toast.error("Геолокация недоступна на этом устройстве");
              }
            })
            .finally(() => setLocating(false));
        }}
      >
        <LocateFixed className="h-4 w-4 shrink-0" aria-hidden />
        {locating ? "Поиск…" : "Найти меня"}
      </Button>
    </div>
  );
}
