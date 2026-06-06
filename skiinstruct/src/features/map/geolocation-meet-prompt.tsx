"use client";

import { MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";

import { locateUserMeetPoint, useMeetPoint } from "@/features/map/use-client-meet-point";
import { Button } from "@/shared/ui/button";

/** Баннер с кнопкой «Разрешить» — запрос GPS только по нажатию (нужно для Android). */
export function GeolocationMeetPrompt() {
  const coordSource = useMeetPoint((s) => s.coordSource);
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState<PermissionState | "unknown">("unknown");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;

    let status: PermissionStatus | undefined;
    void navigator.permissions.query({ name: "geolocation" }).then((s) => {
      status = s;
      setPermission(s.state);
      s.onchange = () => setPermission(s.state);
      if (s.state === "granted") {
        void locateUserMeetPoint().catch(() => {});
      }
    });

    return () => {
      if (status) status.onchange = null;
    };
  }, []);

  if (dismissed || coordSource !== "default" || permission === "denied" || permission === "granted") {
    return null;
  }

  function requestLocation() {
    setRequesting(true);
    void locateUserMeetPoint()
      .catch(() => {})
      .finally(() => setRequesting(false));
  }

  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-sky-950 dark:text-sky-50">
          Разрешите доступ к геолокации — так мы покажем инструкторов рядом с вами
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={requesting} onClick={requestLocation}>
            {requesting ? "Запрос…" : "Разрешить"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Не сейчас
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label="Закрыть"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
