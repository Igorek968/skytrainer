"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { instructorApplyAction, type InstructorApplyState } from "@/app/actions/instructor-apply";
import { FORM_DRAFT_KEYS } from "@/lib/form-draft-storage";
import { LEGAL_ROUTES } from "@/lib/legal";
import { PASSPORT_UPLOAD_MAX_BYTES } from "@/lib/instructor-passport";
import { instructorActivityLabelsAlphabetical } from "@/lib/services/instructor-match";
import { RUSSIAN_EMAIL_EXAMPLES, RUSSIAN_EMAIL_HINT, assertRussianEmail } from "@/lib/russian-email";
import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { resolveUtmForForm } from "@/shared/analytics/utm-capture";
import { useFormDraft } from "@/shared/hooks/use-form-draft";
import { useDisplayNameDuplicateCheck } from "@/shared/hooks/use-display-name-duplicate-check";
import { YM_GOALS, trackYandexGoal } from "@/shared/analytics/yandex-metrika-client";
import { TurnstileWidget } from "@/shared/security/turnstile-widget";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { Label } from "@/shared/ui/label";
import { toast } from "sonner";

const initialState: InstructorApplyState = { error: null, success: false };

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** Клиентская обёртка: сеть/лимит тела → сообщение в форме, а не экран «Failed to fetch». */
async function instructorApplyFormAction(
  prev: InstructorApplyState,
  formData: FormData,
): Promise<InstructorApplyState> {
  try {
    return await instructorApplyAction(prev, formData);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return {
      error: userFacingErrorMessage(
        error,
        "Не удалось отправить анкету. Уменьшите сканы паспорта и НПД (примерно до 4 МБ каждый) и попробуйте снова.",
      ),
      success: false,
    };
  }
}

type InstructorApplyDraft = {
  lastName: string;
  firstName: string;
  middleName: string;
  nickname: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
  primarySpecialization: string;
  hourlyRate: string;
  bio: string;
  taxStatus: string;
  inn: string;
  birthDate: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedAt: string;
  passportDepartmentCode: string;
  achievements: string;
  acceptAgencyOffer: boolean;
  acceptPrivacy: boolean;
};

const defaultDraft: InstructorApplyDraft = {
  lastName: "",
  firstName: "",
  middleName: "",
  nickname: "",
  email: "",
  phone: "",
  password: "",
  passwordConfirm: "",
  primarySpecialization: "",
  hourlyRate: "3000",
  bio: "",
  taxStatus: "SELF_EMPLOYED",
  inn: "",
  birthDate: "",
  passportSeries: "",
  passportNumber: "",
  passportIssuedAt: "",
  passportDepartmentCode: "",
  achievements: "",
  acceptAgencyOffer: false,
  acceptPrivacy: false,
};

function SubmitButton({ disabledByName }: { disabledByName: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      className="w-full"
      type="submit"
      disabled={pending || disabledByName}
      aria-busy={pending}
    >
      {pending ? "Отправка…" : "Отправить заявку на модерацию"}
    </Button>
  );
}

function InstructorApplyForm() {
  const searchParams = useSearchParams();
  const [state, formAction] = useFormState(instructorApplyFormAction, initialState);
  const { values, setField } = useFormDraft<InstructorApplyDraft>(
    FORM_DRAFT_KEYS.instructorApply,
    defaultDraft,
  );
  const displayNameDuplicate = useDisplayNameDuplicateCheck(values.firstName, values.lastName);
  const [utm, setUtm] = useState<Record<string, string>>({});

  useEffect(() => {
    const resolved = resolveUtmForForm(searchParams);
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(resolved)) {
      if (v) next[k] = v;
    }
    setUtm(next);
  }, [searchParams]);

  useEffect(() => {
    if (!state.error) return;
    const el = document.getElementById("instructor-apply-error");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.error]);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <Card>
        <CardHeader>
          <CardTitle as="h1">Стать инструктором</CardTitle>
          <CardDescription>
            Анкета на площадку ТвойТренер.рф: заявки с карты, свой график, оплата онлайн. Укажите ФИО, паспортные
            данные, телефон, ИНН и документ НПД/ЕГРИП (нужны для договора и выплат через ЮKassa). После модерации
            включите «онлайн» и принимайте заявки.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            action={formAction}
            encType="multipart/form-data"
            onSubmit={(e) => {
              const form = e.currentTarget;
              if (!form.checkValidity()) {
                e.preventDefault();
                form.reportValidity();
                return;
              }
              if (values.password !== values.passwordConfirm) {
                e.preventDefault();
                toast.error("Пароли не совпадают");
                return;
              }
              const ruErr = assertRussianEmail(values.email);
              if (ruErr) {
                e.preventDefault();
                toast.error(ruErr);
                return;
              }
              if (!values.acceptAgencyOffer || !values.acceptPrivacy) {
                e.preventDefault();
                toast.error("Примите агентскую оферту и политику ПДн");
                return;
              }
              const passport = (form.elements.namedItem("passportScan") as HTMLInputElement | null)
                ?.files?.[0];
              const taxDoc = (form.elements.namedItem("taxDocumentScan") as HTMLInputElement | null)
                ?.files?.[0];
              const maxEach = PASSPORT_UPLOAD_MAX_BYTES;
              if (passport && passport.size > maxEach) {
                e.preventDefault();
                toast.error("Файл паспорта: максимум 8 МБ");
                return;
              }
              if (taxDoc && taxDoc.size > maxEach) {
                e.preventDefault();
                toast.error("Файл НПД/ЕГРИП: максимум 8 МБ");
                return;
              }
              const combined = (passport?.size ?? 0) + (taxDoc?.size ?? 0);
              if (combined > 18 * 1024 * 1024) {
                e.preventDefault();
                toast.error("Оба скана вместе слишком тяжёлые — сожмите фото примерно до 4–6 МБ каждое");
                return;
              }
              trackYandexGoal(
                YM_GOALS.instructorApplySubmit,
                Object.keys(utm).length ? utm : undefined,
              );
            }}
          >
            {Object.entries(utm).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <div className="space-y-2">
              <Label htmlFor="lastName">Фамилия</Label>
              <Input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                required
                maxLength={80}
                aria-invalid={Boolean(state.error)}
                value={values.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Имя</Label>
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                required
                maxLength={80}
                aria-invalid={Boolean(state.error)}
                value={values.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Отчество (как в паспорте)</Label>
              <Input
                id="middleName"
                name="middleName"
                autoComplete="additional-name"
                required
                maxLength={80}
                aria-invalid={Boolean(state.error)}
                value={values.middleName}
                onChange={(e) => setField("middleName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Никнейм</Label>
              <Input
                id="nickname"
                name="nickname"
                autoComplete="nickname"
                required
                maxLength={80}
                aria-invalid={Boolean(state.error)}
                value={values.nickname}
                onChange={(e) => setField("nickname", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Как вас будут видеть клиенты на сайте. Имя и фамилия нужны для проверки уникальности и модерации.
              </p>
              {displayNameDuplicate.duplicate ? (
                <p className="text-xs text-destructive">{displayNameDuplicate.message}</p>
              ) : displayNameDuplicate.checking && values.firstName.trim() && values.lastName.trim() ? (
                <p className="text-xs text-muted-foreground">Проверка имени…</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email для входа</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@mail.ru"
                aria-invalid={Boolean(state.error)}
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {RUSSIAN_EMAIL_HINT} {RUSSIAN_EMAIL_EXAMPLES}.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Номер телефона</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                inputMode="tel"
                placeholder="+7 900 000-00-00"
                aria-invalid={Boolean(state.error)}
                value={values.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Виден только администрации платформы, клиентам не показывается.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={values.password}
                onChange={(e) => setField("password", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Пароль — не менее 8 знаков.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">Пароль ещё раз</Label>
              <PasswordInput
                id="passwordConfirm"
                name="passwordConfirm"
                autoComplete="new-password"
                required
                minLength={8}
                value={values.passwordConfirm}
                onChange={(e) => setField("passwordConfirm", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primarySpecialization">Основное направление</Label>
              <select
                id="primarySpecialization"
                name="primarySpecialization"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={values.primarySpecialization}
                onChange={(e) => setField("primarySpecialization", e.target.value)}
              >
                <option value="" disabled>
                  Выберите…
                </option>
                {instructorActivityLabelsAlphabetical().map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Ставка, ₽/час</Label>
              <Input
                id="hourlyRate"
                name="hourlyRate"
                type="number"
                min={500}
                step={100}
                required
                value={values.hourlyRate}
                onChange={(e) => setField("hourlyRate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">О себе и опыте</Label>
              <textarea
                id="bio"
                name="bio"
                required
                minLength={20}
                maxLength={300}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Сертификаты, стаж, с кем работаете (дети, взрослые)…"
                value={values.bio}
                onChange={(e) => setField("bio", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">О себе — не менее 20 и не более 300 знаков.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxStatus">Налоговый статус</Label>
              <select
                id="taxStatus"
                name="taxStatus"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={values.taxStatus}
                onChange={(e) => setField("taxStatus", e.target.value)}
              >
                <option value="SELF_EMPLOYED">Самозанятый (НПД)</option>
                <option value="IP">Индивидуальный предприниматель</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inn">ИНН (обязательно)</Label>
              <Input
                id="inn"
                name="inn"
                required
                inputMode="numeric"
                pattern="\d{10,12}"
                minLength={10}
                maxLength={12}
                placeholder="10 или 12 цифр"
                aria-invalid={Boolean(state.error)}
                value={values.inn}
                onChange={(e) => setField("inn", e.target.value.replace(/\D/g, "").slice(0, 12))}
              />
              <p className="text-xs text-muted-foreground">
                ИНН самозанятого или ИП — для выплат. Без него заявка не уйдёт на модерацию.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxDocumentScan">
                {values.taxStatus === "IP"
                  ? "Документ ИП (выписка ЕГРИП)"
                  : "Документ НПД (справка из «Мой налог»)"}
              </Label>
              <Input
                id="taxDocumentScan"
                name="taxDocumentScan"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
              />
              <p className="text-xs text-muted-foreground">
                {values.taxStatus === "IP" ? (
                  <>
                    Где взять: на{" "}
                    <a
                      className="text-accent underline"
                      href="https://egrul.nalog.ru/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      egrul.nalog.ru
                    </a>{" "}
                    или в личном кабинете ИП на nalog.ru — выписка из ЕГРИП (PDF). JPG, PNG, WEBP или PDF, до 8 МБ.
                  </>
                ) : (
                  <>
                    Где взять: приложение или сайт «Мой налог» → раздел о статусе самозанятого → справка о постановке на
                    учёт (или подтверждение статуса НПД). JPG, PNG, WEBP или PDF, до 8 МБ.
                  </>
                )}
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
              <p className="text-sm font-medium">Паспортные данные (обязательно)</p>
              <p className="text-xs text-muted-foreground">
                Нужны для идентификации по договору. Видны только администрации, клиентам не показываются.
              </p>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Дата рождения</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  required
                  value={values.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="passportSeries">Серия паспорта</Label>
                  <Input
                    id="passportSeries"
                    name="passportSeries"
                    required
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1234"
                    value={values.passportSeries}
                    onChange={(e) => setField("passportSeries", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passportNumber">Номер паспорта</Label>
                  <Input
                    id="passportNumber"
                    name="passportNumber"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="567890"
                    value={values.passportNumber}
                    onChange={(e) => setField("passportNumber", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportIssuedAt">Дата выдачи</Label>
                <Input
                  id="passportIssuedAt"
                  name="passportIssuedAt"
                  type="date"
                  required
                  value={values.passportIssuedAt}
                  onChange={(e) => setField("passportIssuedAt", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportDepartmentCode">Код подразделения</Label>
                <Input
                  id="passportDepartmentCode"
                  name="passportDepartmentCode"
                  required
                  inputMode="numeric"
                  placeholder="770-001"
                  maxLength={7}
                  value={values.passportDepartmentCode}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                    const next =
                      digits.length <= 3 ? digits : `${digits.slice(0, 3)}-${digits.slice(3)}`;
                    setField("passportDepartmentCode", next);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportScan">Фото / скан паспорта (стр. 2–3)</Label>
                <Input
                  id="passportScan"
                  name="passportScan"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                />
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WEBP или PDF, до 8 МБ. Разворот паспорта со стр. 2–3 (фото и личные данные).
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="achievements">Достижения (по одному на строку, необязательно)</Label>
              <textarea
                id="achievements"
                name="achievements"
                rows={3}
                className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Победы, звания, курсы…"
                value={values.achievements}
                onChange={(e) => setField("achievements", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex min-h-10 w-full cursor-pointer items-start gap-3 rounded-md border border-input bg-background px-3 py-2.5 text-sm">
                <input
                  name="acceptAgencyOffer"
                  type="checkbox"
                  required
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={values.acceptAgencyOffer}
                  onChange={(e) => setField("acceptAgencyOffer", e.target.checked)}
                />
                <span>
                  Принимаю{" "}
                  <Link className="text-accent underline" href={LEGAL_ROUTES.ofertaInstructor}>
                    договор для инструктора (оферту)
                  </Link>{" "}
                  и подтверждаю статус самозанятого/ИП
                </span>
              </label>
            </div>
            <div className="space-y-2">
              <label className="flex min-h-10 w-full cursor-pointer items-start gap-3 rounded-md border border-input bg-background px-3 py-2.5 text-sm">
                <input
                  name="acceptPrivacy"
                  type="checkbox"
                  required
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={values.acceptPrivacy}
                  onChange={(e) => setField("acceptPrivacy", e.target.checked)}
                />
                <span>
                  Согласен с{" "}
                  <Link className="text-accent underline" href={LEGAL_ROUTES.privacy}>
                    политикой обработки персональных данных
                  </Link>
                </span>
              </label>
            </div>

            {state.error ? (
              <div
                id="instructor-apply-error"
                role="alert"
                className="sticky bottom-20 z-10 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive shadow-sm sm:static"
              >
                <p className="font-medium">Не удалось отправить анкету</p>
                <p className="mt-1">{state.error}</p>
                <p className="mt-1 text-xs text-destructive/80">
                  Частые причины: почта не Mail.ru/Яндекс, ИНН 10/12 цифр, скан паспорта и НПД/ЕГРИП, пароли не
                  совпадают.
                </p>
              </div>
            ) : null}

            <TurnstileWidget className="py-1" />

            <SubmitButton disabledByName={displayNameDuplicate.duplicate} />
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Уже одобрены?{" "}
            <Link className="text-accent underline" href="/instructor/login">
              Вход в кабинет
            </Link>
            {" · "}
            <Link className="text-accent underline" href="/">
              На главную
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InstructorApplyPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-lg h-48 animate-pulse rounded-xl bg-muted/60" aria-hidden />}
    >
      <InstructorApplyForm />
    </Suspense>
  );
}
