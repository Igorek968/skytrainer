"use client";

import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useGeolocationDialog } from "@/features/map/geolocation-dialog-store";
import { geolocationErrorCode } from "@/features/map/request-user-geolocation";
import { Button } from "@/shared/ui/button";

export function LocateMeControl({ onLocate }: { onLocate: () => Promise<void> }) {
  const [locating, setLocating] = useState(false);
  const showBlocked = useGeolocationDialog((s) => s.showBlocked);

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
              const code = geolocationErrorCode(err);
              if (code === "GEO_DENIED") {
                showBlocked();
              } else if (code === "GEO_UNSUPPORTED") {
                toast.error("Геолокация не поддерживается этим браузером");
              } else if (code === "GEO_INSECURE") {
                toast.error("Геолокация доступна только по HTTPS");
              } else {
                toast.error("Геолокация недоступна. Проверьте GPS на телефоне.");
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
