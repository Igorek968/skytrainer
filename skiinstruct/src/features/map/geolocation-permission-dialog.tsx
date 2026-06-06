"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  dismissGeolocationPrompt,
  isGeolocationPromptDismissed,
  useGeolocationDialog,
} from "@/features/map/geolocation-dialog-store";
import {
  applyGeolocationToMeetPoint,
  geolocationErrorCode,
  requestUserGeolocation,
} from "@/features/map/request-user-geolocation";
import { useMeetPoint } from "@/features/map/use-client-meet-point";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent } from "@/shared/ui/dialog";

const SITE_LABEL = "utrainer.ru";

/**
 * Диалог «Включить / Отмена» — по «Включить» вызывается системный запрос браузера
 * (navigator.geolocation.getCurrentPosition в обработчике клика).
 */
export function GeolocationPermissionDialog() {
  const coordSource = useMeetPoint((s) => s.coordSource);
  const { open, view, showPrompt, showBlocked, close } = useGeolocationDialog();
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (coordSource !== "default" || isGeolocationPromptDismissed()) return;

    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      showPrompt();
      return;
    }

    void navigator.permissions.query({ name: "geolocation" }).then((status) => {
      if (status.state === "granted") {
        void requestUserGeolocation()
          .then(applyGeolocationToMeetPoint)
          .catch(() => {});
        return;
      }
      showPrompt();
    });
  }, [coordSource, showPrompt]);

  function enableLocation() {
    setRequesting(true);
    requestUserGeolocation()
      .then((position) => {
        applyGeolocationToMeetPoint(position);
        close();
        toast.success("Местоположение определено");
      })
      .catch((err) => {
        const code = geolocationErrorCode(err);
        if (code === "GEO_DENIED") {
          showBlocked();
        } else if (code === "GEO_INSECURE") {
          toast.error("Геолокация доступна только по HTTPS");
          close();
        } else if (code === "GEO_UNSUPPORTED") {
          toast.error("Геолокация не поддерживается этим браузером");
          close();
        } else {
          toast.error("Не удалось определить местоположение. Проверьте GPS на телефоне.");
        }
      })
      .finally(() => setRequesting(false));
  }

  function cancel() {
    dismissGeolocationPrompt();
    close();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          if (view === "prompt") dismissGeolocationPrompt();
          close();
        }
      }}
    >
      <DialogContent
        className="gap-0 p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {view === "prompt" ? (
          <div className="p-6">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950">
                <MapPin className="h-7 w-7 text-sky-600 dark:text-sky-400" aria-hidden />
              </div>
            </div>
            <h2 className="text-center text-lg font-semibold">Доступ к местоположению</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{SITE_LABEL}</span> запрашивает доступ к вашему
              местоположению, чтобы показать инструкторов рядом с вами.
            </p>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              После нажатия «Включить» браузер покажет системный запрос — подтвердите доступ там.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={requesting} onClick={cancel}>
                Отмена
              </Button>
              <Button type="button" disabled={requesting} onClick={enableLocation}>
                {requesting ? "Запрос…" : "Включить"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <h2 className="text-lg font-semibold">Доступ к геолокации запрещён</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Браузер не показал запрос или вы ранее нажали «Запретить». Сайт не может включить GPS сам — это
              делает только браузер.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Нажмите на значок замка или «i» слева от адреса сайта в строке браузера.</li>
              <li>Откройте «Разрешения» или «Настройки сайта».</li>
              <li>Выберите «Местоположение» → «Разрешить».</li>
              <li>Обновите страницу и нажмите «Включить» снова.</li>
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">
              В приложении Яндекс: меню ⋮ → «Информация о странице» → «Разрешения» → «Геолокация».
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close}>
                Понятно
              </Button>
              <Button type="button" disabled={requesting} onClick={enableLocation}>
                Попробовать снова
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
