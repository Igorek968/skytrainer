"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { instructorApplyAction, type InstructorApplyState } from "@/app/actions/instructor-apply";
import { INSTRUCTOR_ACTIVITY_LABELS } from "@/lib/services/instructor-match";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: InstructorApplyState = { error: null, success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Отправка…" : "Отправить заявку на модерацию"}
    </Button>
  );
}

export default function InstructorApplyPage() {
  const [state, formAction] = useFormState(instructorApplyAction, initialState);

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
          <form className="space-y-4" action={formAction} noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Имя / как к вам обращаться</Label>
              <Input id="name" name="name" required maxLength={120} aria-invalid={Boolean(state.error)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email для входа</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.error)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">Пароль ещё раз</Label>
                <Input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
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
                defaultValue=""
              >
                <option value="" disabled>
                  Выберите…
                </option>
                {INSTRUCTOR_ACTIVITY_LABELS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Ставка, ₽/час</Label>
              <Input id="hourlyRate" name="hourlyRate" type="number" min={500} step={100} required defaultValue={3000} />
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="achievements">Достижения (по одному на строку, необязательно)</Label>
              <textarea
                id="achievements"
                name="achievements"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Победы, звания, курсы…"
              />
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <SubmitButton />
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
