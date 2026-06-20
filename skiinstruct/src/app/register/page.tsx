"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { registerClientAction, type RegisterClientState } from "@/app/actions/register-client";
import { FORM_DRAFT_KEYS } from "@/lib/form-draft-storage";
import { Button } from "@/shared/ui/button";
import { LegalConsentCheckbox } from "@/shared/legal/legal-consent-checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { Label } from "@/shared/ui/label";
import { useFormDraft } from "@/shared/hooks/use-form-draft";

const initialState: RegisterClientState = { error: null };

type RegisterDraft = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  acceptLegal: boolean;
};

const defaultDraft: RegisterDraft = {
  name: "",
  email: "",
  password: "",
  passwordConfirm: "",
  acceptLegal: false,
};

function SubmitButton({ acceptLegal }: { acceptLegal: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending || !acceptLegal} aria-busy={pending}>
      {pending ? "Регистрация…" : "Зарегистрироваться"}
    </Button>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl")?.trim() || "/client";
  const referralCode = params.get("ref")?.trim() || undefined;
  const asInstructor =
    params.get("as") === "instructor" || params.get("role") === "instructor";

  useEffect(() => {
    if (asInstructor) {
      router.replace("/instructor/login");
    }
  }, [asInstructor, router]);

  const [state, formAction] = useFormState(registerClientAction, initialState);
  const { values, setField } = useFormDraft<RegisterDraft>(
    FORM_DRAFT_KEYS.clientRegister,
    defaultDraft,
  );

  if (asInstructor) {
    return (
      <div className="mx-auto max-w-md py-8 text-center text-sm text-muted-foreground">
        Переход к регистрации инструктора…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="space-y-2 pt-6 text-sm">
          <p className="font-medium text-foreground">Вы инструктор?</p>
          <p className="text-muted-foreground">
            Регистрация клиента откроет кабинет заказчика. Для заявки инструктора используйте отдельную
            форму — после неё вы попадёте в кабинет инструктора (после одобрения администратором).
          </p>
          <Button asChild variant="accent" className="w-full">
            <Link href="/instructor/login">Вход для инструктора</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h1">Регистрация клиента</CardTitle>
          <CardDescription>
            Укажите email и пароль — после регистрации вы сразу войдёте и сможете оформить заказ на{" "}
            <Link className="text-accent underline" href="/client">
              /client
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" action={formAction} noValidate>
            <input type="hidden" name="redirectTo" value={callbackUrl} />
            {referralCode ? <input type="hidden" name="referralCode" value={referralCode} /> : null}

            <div className="space-y-2">
              <Label htmlFor="reg-name">Имя (необязательно)</Label>
              <Input
                id="reg-name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength={120}
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                aria-invalid={Boolean(state.error)}
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Пароль</Label>
              <PasswordInput
                id="reg-password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-invalid={Boolean(state.error)}
                value={values.password}
                onChange={(e) => setField("password", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Не меньше 8 символов.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password2">Пароль ещё раз</Label>
              <PasswordInput
                id="reg-password2"
                name="passwordConfirm"
                autoComplete="new-password"
                required
                minLength={8}
                aria-invalid={Boolean(state.error)}
                value={values.passwordConfirm}
                onChange={(e) => setField("passwordConfirm", e.target.value)}
              />
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <LegalConsentCheckbox
              id="reg-accept-legal"
              checked={values.acceptLegal}
              onChange={(checked) => setField("acceptLegal", checked)}
              includeReturns
            />

            <SubmitButton acceptLegal={values.acceptLegal} />
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link className="text-accent underline" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
              Войти
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Инструктор?{" "}
            <Link className="font-medium text-accent underline" href="/instructor/login">
              Вход инструктора
            </Link>
            {" · "}
            <Link className="text-accent underline" href="/instructor/login">
              Вход
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-md h-48 animate-pulse rounded-xl bg-muted/60" aria-hidden />}
    >
      <RegisterForm />
    </Suspense>
  );
}
