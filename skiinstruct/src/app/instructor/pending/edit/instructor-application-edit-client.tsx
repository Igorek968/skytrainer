"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LEGAL_ROUTES } from "@/lib/legal";
import { instructorActivityLabelsAlphabetical } from "@/lib/services/instructor-match";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type Application = {
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  nickname: string;
  phone: string;
  bio: string;
  hourlyRate: number;
  primarySpecialization: string;
  achievements: string;
  taxStatus: "SELF_EMPLOYED" | "IP";
  inn: string;
  birthDate: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedAt: string;
  passportDepartmentCode: string;
  hasPassportScan: boolean;
  hasTaxDocument: boolean;
  rejectNote: string | null;
};

type FormState = Omit<
  Application,
  "email" | "hasPassportScan" | "hasTaxDocument" | "rejectNote" | "hourlyRate"
> & {
  hourlyRate: string;
};

export function InstructorApplicationEditClient() {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["instructor-application-edit"],
    queryFn: async () => {
      const r = await fetch("/api/instructor/application", { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        verificationStatus?: string;
        application?: Application;
      };
      if (!r.ok) throw new Error(j.error ?? "Не удалось загрузить анкету");
      return j as { verificationStatus: string; application: Application };
    },
  });

  useEffect(() => {
    if (!data?.application) return;
    if (data.verificationStatus === "PENDING") {
      toast.message("Заявка уже на модерации");
      router.replace("/instructor/pending");
      return;
    }
    if (data.verificationStatus === "APPROVED") {
      router.replace("/instructor");
      return;
    }
    const a = data.application;
    setForm({
      lastName: a.lastName,
      firstName: a.firstName,
      middleName: a.middleName,
      nickname: a.nickname,
      phone: a.phone,
      bio: a.bio,
      hourlyRate: String(a.hourlyRate || 3000),
      primarySpecialization: a.primarySpecialization,
      achievements: a.achievements,
      taxStatus: a.taxStatus,
      inn: a.inn,
      birthDate: a.birthDate,
      passportSeries: a.passportSeries,
      passportNumber: a.passportNumber,
      passportIssuedAt: a.passportIssuedAt,
      passportDepartmentCode: a.passportDepartmentCode,
    });
  }, [data, router]);

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const r = await fetch("/api/instructor/application", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не удалось сохранить");
      return j;
    },
    onSuccess: () => {
      toast.success("Анкета обновлена и снова отправлена на модерацию");
      router.replace("/instructor/pending");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (isLoading || (!form && !isError)) {
    return <p className="text-sm text-muted-foreground">Загрузка анкеты…</p>;
  }

  if (isError || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось открыть анкету</CardTitle>
          <CardDescription>{error instanceof Error ? error.message : "Ошибка загрузки"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/instructor/pending">Назад</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const rejectNote = data?.application.rejectNote?.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Редактирование анкеты</CardTitle>
        <CardDescription>
          Исправьте данные по комментарию администратора и отправьте заявку снова. Email:{" "}
          <span className="font-medium text-foreground">{data?.application.email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rejectNote ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">
            <p className="font-medium text-foreground">Комментарий администратора</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{rejectNote}</p>
          </div>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            save.mutate(fd);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="lastName">Фамилия</Label>
              <Input
                id="lastName"
                name="lastName"
                required
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Имя</Label>
              <Input
                id="firstName"
                name="firstName"
                required
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Отчество</Label>
              <Input
                id="middleName"
                name="middleName"
                required
                value={form.middleName}
                onChange={(e) => setField("middleName", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">Никнейм</Label>
            <Input
              id="nickname"
              name="nickname"
              required
              minLength={2}
              value={form.nickname}
              onChange={(e) => setField("nickname", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              name="phone"
              required
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primarySpecialization">Основное направление</Label>
            <select
              id="primarySpecialization"
              name="primarySpecialization"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.primarySpecialization}
              onChange={(e) => setField("primarySpecialization", e.target.value)}
            >
              <option value="">Выберите…</option>
              {instructorActivityLabelsAlphabetical().map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hourlyRate">Ставка, ₽/ч</Label>
            <Input
              id="hourlyRate"
              name="hourlyRate"
              type="number"
              required
              min={500}
              value={form.hourlyRate}
              onChange={(e) => setField("hourlyRate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">О себе</Label>
            <textarea
              id="bio"
              name="bio"
              required
              minLength={20}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.bio}
              onChange={(e) => setField("bio", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="achievements">Достижения (по строкам)</Label>
            <textarea
              id="achievements"
              name="achievements"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.achievements}
              onChange={(e) => setField("achievements", e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="taxStatus">Налоговый статус</Label>
              <select
                id="taxStatus"
                name="taxStatus"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.taxStatus}
                onChange={(e) => setField("taxStatus", e.target.value as "SELF_EMPLOYED" | "IP")}
              >
                <option value="SELF_EMPLOYED">Самозанятый (НПД)</option>
                <option value="IP">Индивидуальный предприниматель</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inn">ИНН</Label>
              <Input
                id="inn"
                name="inn"
                required
                inputMode="numeric"
                maxLength={12}
                value={form.inn}
                onChange={(e) => setField("inn", e.target.value.replace(/\D/g, "").slice(0, 12))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxDocumentScan">
              {form.taxStatus === "IP"
                ? "Документ ИП (выписка ЕГРИП)"
                : "Документ НПД (справка из «Мой налог»)"}
              {data?.application.hasTaxDocument ? " — новый файл, если нужно заменить" : ""}
            </Label>
            <Input
              id="taxDocumentScan"
              name="taxDocumentScan"
              type="file"
              accept="image/*,.pdf,application/pdf"
              required={!data?.application.hasTaxDocument}
            />
            <p className="text-xs text-muted-foreground">
              {form.taxStatus === "IP" ? (
                <>
                  Где взять:{" "}
                  <a
                    className="text-accent underline"
                    href="https://egrul.nalog.ru/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    egrul.nalog.ru
                  </a>{" "}
                  или кабинет ИП на nalog.ru — выписка ЕГРИП (PDF).
                </>
              ) : (
                <>
                  Где взять: приложение «Мой налог» → статус самозанятого → справка о постановке на учёт / подтверждение
                  НПД.
                </>
              )}
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium">Паспортные данные</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birthDate">Дата рождения</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  required
                  value={form.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportIssuedAt">Дата выдачи</Label>
                <Input
                  id="passportIssuedAt"
                  name="passportIssuedAt"
                  type="date"
                  required
                  value={form.passportIssuedAt}
                  onChange={(e) => setField("passportIssuedAt", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportSeries">Серия</Label>
                <Input
                  id="passportSeries"
                  name="passportSeries"
                  required
                  inputMode="numeric"
                  maxLength={4}
                  value={form.passportSeries}
                  onChange={(e) => setField("passportSeries", e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportNumber">Номер</Label>
                <Input
                  id="passportNumber"
                  name="passportNumber"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={form.passportNumber}
                  onChange={(e) => setField("passportNumber", e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="passportDepartmentCode">Код подразделения</Label>
                <Input
                  id="passportDepartmentCode"
                  name="passportDepartmentCode"
                  required
                  placeholder="XXX-XXX"
                  value={form.passportDepartmentCode}
                  onChange={(e) => setField("passportDepartmentCode", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="passportScan">
                  Скан паспорта (стр. 2–3)
                  {data?.application.hasPassportScan ? " — новый файл, если нужно заменить" : ""}
                </Label>
                <Input id="passportScan" name="passportScan" type="file" accept="image/*,.pdf,application/pdf" />
                <p className="text-xs text-muted-foreground">
                  Если отклонили из‑за фото паспорта или файл не открывается у админа — загрузите скан заново.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Отправляя анкету, вы подтверждаете актуальность данных и согласие с{" "}
            <Link className="text-accent underline" href={LEGAL_ROUTES.ofertaInstructor}>
              офертой инструктора
            </Link>
            .
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="accent" disabled={save.isPending} className="sm:flex-1">
              {save.isPending ? "Сохранение…" : "Сохранить и отправить на модерацию"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/instructor/pending">Назад</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
