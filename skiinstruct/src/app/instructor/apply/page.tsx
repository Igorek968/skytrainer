"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { instructorApplyAction, type InstructorApplyState } from "@/app/actions/instructor-apply";
import { FORM_DRAFT_KEYS } from "@/lib/form-draft-storage";
import { LEGAL_ROUTES } from "@/lib/legal";
import { instructorActivityLabelsAlphabetical } from "@/lib/services/instructor-match";
import { parseFullNameToParts } from "@/lib/user-display-name";
import { useFormDraft } from "@/shared/hooks/use-form-draft";
import { useDisplayNameDuplicateCheck } from "@/shared/hooks/use-display-name-duplicate-check";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { Label } from "@/shared/ui/label";

const initialState: InstructorApplyState = { error: null, success: false };

type InstructorApplyDraft = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  primarySpecialization: string;
  hourlyRate: string;
  bio: string;
  taxStatus: string;
  inn: string;
  achievements: string;
  acceptAgencyOffer: boolean;
  acceptPrivacy: boolean;
};

const defaultDraft: InstructorApplyDraft = {
  name: "",
  email: "",
  password: "",
  passwordConfirm: "",
  primarySpecialization: "",
  hourlyRate: "3000",
  bio: "",
  taxStatus: "SELF_EMPLOYED",
  inn: "",
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

export default function InstructorApplyPage() {
  const [state, formAction] = useFormState(instructorApplyAction, initialState);
  const { values, setField } = useFormDraft<InstructorApplyDraft>(
    FORM_DRAFT_KEYS.instructorApply,
    defaultDraft,
  );
  const { firstName, lastName } = useMemo(
    () => parseFullNameToParts(values.name),
    [values.name],
  );
  const displayNameDuplicate = useDisplayNameDuplicateCheck(firstName, lastName);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <Card>
        <CardHeader>
          <CardTitle>Стать инструктором</CardTitle>
          <CardDescription>
            Заполните анкету. После проверки администратором вы сможете войти, включить статус «онлайн» и принимать
            заявки клиентов по всей России (поиск рядом — в радиусе 5 км от точки встречи).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            action={formAction}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="name">Имя / как к вам обращаться</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                aria-invalid={Boolean(state.error)}
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Укажите имя и фамилию через пробел — по ним клиенты найдут вас на сайте.
              </p>
              {displayNameDuplicate.duplicate ? (
                <p className="text-xs text-destructive">{displayNameDuplicate.message}</p>
              ) : displayNameDuplicate.checking && firstName && lastName ? (
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
                aria-invalid={Boolean(state.error)}
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Сертификаты, стаж, с кем работаете (дети, взрослые)…"
                value={values.bio}
                onChange={(e) => setField("bio", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxStatus">Налоговый статус</Label>
                <select
                  id="taxStatus"
                  name="taxStatus"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={values.taxStatus}
                  onChange={(e) => setField("taxStatus", e.target.value)}
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
                  pattern="\d{10,12}"
                  placeholder="10 или 12 цифр"
                  value={values.inn}
                  onChange={(e) => setField("inn", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="achievements">Достижения (по одному на строку, необязательно)</Label>
              <textarea
                id="achievements"
                name="achievements"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Победы, звания, курсы…"
                value={values.achievements}
                onChange={(e) => setField("achievements", e.target.value)}
              />
            </div>

            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              <label className="flex gap-2">
                <input
                  name="acceptAgencyOffer"
                  type="checkbox"
                  required
                  className="mt-1"
                  checked={values.acceptAgencyOffer}
                  onChange={(e) => setField("acceptAgencyOffer", e.target.checked)}
                />
                <span>
                  Принимаю{" "}
                  <Link className="text-accent underline" href={LEGAL_ROUTES.ofertaInstructor}>
                    агентский договор (оферту)
                  </Link>{" "}
                  и подтверждаю статус самозанятого/ИП
                </span>
              </label>
              <label className="flex gap-2">
                <input
                  name="acceptPrivacy"
                  type="checkbox"
                  required
                  className="mt-1"
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

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

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
