"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { InstructorPhoto } from "@/shared/ui/instructor-photo";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { redirectToYooCardBinding } from "@/lib/payments/redirect-to-checkout";
import { parseFullNameToParts } from "@/lib/user-display-name";
import { useDisplayNameDuplicateCheck } from "@/shared/hooks/use-display-name-duplicate-check";

type MeProfile = {
  name: string | null;
  email: string;
  image: string | null;
  birthDate: string | null;
};

type CardStatus = {
  hasCard: boolean;
  brand: string | null;
  last4: string | null;
  mock?: boolean;
};

export function PersonalDataDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const { firstName, lastName } = useMemo(() => parseFullNameToParts(name), [name]);
  const displayNameDuplicate = useDisplayNameDuplicateCheck(firstName, lastName, open);

  const { data, isLoading } = useQuery({
    queryKey: ["me-profile", userId],
    queryFn: async () => {
      const r = await fetch("/api/me/profile", { cache: "no-store" });
      if (!r.ok) throw new Error("profile");
      return r.json() as Promise<MeProfile>;
    },
    enabled: open && Boolean(userId),
  });

  const cardQuery = useQuery({
    queryKey: ["me-card-status", userId],
    queryFn: async () => {
      const r = await fetch("/api/me/payment-method", { cache: "no-store" });
      if (!r.ok) throw new Error("card");
      return r.json() as Promise<CardStatus>;
    },
    enabled: open && Boolean(userId),
  });

  useEffect(() => {
    if (!open || !data) return;
    setName(data.name ?? "");
    setBirthDate(data.birthDate ?? "");
  }, [open, data]);

  const save = useMutation({
    mutationFn: async () => {
      if (displayNameDuplicate.duplicate) {
        throw new Error(displayNameDuplicate.message ?? "Укажите другие имя или фамилию");
      }
      const tn = name.trim();
      const bd = birthDate.trim();
      const body: { name?: string; birthDate: string } = { birthDate: bd === "" ? "" : bd };
      if (tn.length >= 1) body.name = tn;

      if (!body.name && body.birthDate === "") {
        throw new Error("Укажите Ф.И.О. или дату рождения.");
      }

      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const rawText = await r.text();
      let j: { error?: unknown; details?: unknown } = {};
      try {
        j = rawText ? (JSON.parse(rawText) as typeof j) : {};
      } catch {
        throw new Error(
          rawText?.slice(0, 120) || `Сервер вернул ответ ${r.status} (не JSON). Проверьте консоль сети.`
        );
      }
      if (!r.ok) {
        if (typeof j.error === "string" && j.error.length > 0) {
          throw new Error(j.error);
        }
        const errObj =
          j.error && typeof j.error === "object"
            ? (j.error as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> })
            : null;
        const fromForm = errObj?.formErrors?.filter(Boolean)[0];
        const flat = errObj?.fieldErrors;
        const fromField =
          flat && (Object.values(flat).flat().filter(Boolean)[0] as string | undefined);
        throw new Error(fromForm || fromField || `Ошибка ${r.status}`);
      }
      return j as MeProfile;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me-profile"] });
      toast.success("Личные данные сохранены");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось сохранить"),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch("/api/me/photo", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { image?: string; error?: unknown };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "upload");
      return j.image as string;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me-profile"] });
      toast.success("Фото обновлено");
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось загрузить фото"),
  });

  const setupCard = useMutation({
    mutationFn: async () => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      await redirectToYooCardBinding(`${origin}/client?card=updated`);
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось открыть привязку карты"),
  });

  if (!open) return null;

  const previewSrc = data?.image ?? null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="personal-data-title"
      onClick={() => onOpenChange(false)}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-5 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
        <h2 id="personal-data-title" className="text-lg font-semibold tracking-tight">
          Личные данные
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Укажите Ф.И.О. и дату рождения — они отображаются в шапке рядом с названием сервиса. Фото видно
          инструктору в заказах.
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Загрузка…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                {previewSrc ? (
                  <InstructorPhoto src={previewSrc} alt="Фото профиля" size={80} className="h-full w-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    Нет фото
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="pd-photo">Фото профиля</Label>
                <Input
                  id="pd-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="text-xs"
                  disabled={uploadPhoto.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) uploadPhoto.mutate(f);
                  }}
                />
                <p className="text-[11px] text-muted-foreground">JPG, PNG или WEBP, до 5 МБ.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pd-name">Ф.И.О.</Label>
              <Input
                id="pd-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                autoComplete="name"
              />
              {displayNameDuplicate.duplicate ? (
                <p className="text-xs text-destructive">{displayNameDuplicate.message}</p>
              ) : displayNameDuplicate.checking && firstName && lastName ? (
                <p className="text-xs text-muted-foreground">Проверка имени…</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pd-birth">Дата рождения</Label>
              <Input
                id="pd-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Очистите поле и сохраните, чтобы убрать дату.</p>
            </div>

            {data?.email ? (
              <p className="text-xs text-muted-foreground">
                Email для входа: <span className="text-foreground">{data.email}</span> (меняется только через
                поддержку).
              </p>
            ) : null}

            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-foreground">Банковская карта</p>
              {cardQuery.isLoading ? (
                <p className="mt-1 text-muted-foreground">Проверяем статус карты…</p>
              ) : cardQuery.data?.hasCard ? (
                <p className="mt-1 text-muted-foreground">
                  Карта привязана:{" "}
                  <span className="text-foreground">
                    {cardQuery.data.brand?.toUpperCase() ?? "CARD"} •••• {cardQuery.data.last4 ?? "****"}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Карта не привязана. Без карты заказ инструктору не отправится — привяжите её здесь или при первом
                  заказе (ЮKassa).
                </p>
              )}
              <div className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={setupCard.isPending}
                  onClick={() => setupCard.mutate()}
                >
                  {cardQuery.data?.hasCard ? "Обновить карту" : "Привязать карту"}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Закрыть
              </Button>
              <Button
                type="button"
                variant="accent"
                disabled={save.isPending || displayNameDuplicate.duplicate}
                onClick={() => save.mutate()}
              >
                Сохранить
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
