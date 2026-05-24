"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { registerClientAction, type RegisterClientState } from "@/app/actions/register-client";
import { LEGAL_ROUTES } from "@/lib/legal";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: RegisterClientState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Регистрация…" : "Зарегистрироваться"}
    </Button>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl")?.trim() || "/client";
  const asInstructor =
    params.get("as") === "instructor" || params.get("role") === "instructor";

  useEffect(() => {
    if (asInstructor) {
      router.replace("/instructor/apply");
    }
  }, [asInstructor, router]);

  const [state, formAction] = useFormState(registerClientAction, initialState);

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
            <Link href="/instructor/apply">Зарегистрироваться как инструктор</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Регистрация клиента</CardTitle>
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

            <div className="space-y-2">
              <Label htmlFor="reg-name">Имя (необязательно)</Label>
              <Input id="reg-name" name="name" type="text" autoComplete="name" maxLength={120} />
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Пароль</Label>
              <Input
                id="reg-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-invalid={Boolean(state.error)}
              />
              <p className="text-xs text-muted-foreground">Не меньше 8 символов.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password2">Пароль ещё раз</Label>
              <Input
                id="reg-password2"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-invalid={Boolean(state.error)}
              />
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <p className="text-xs text-muted-foreground">
              Регистрируясь, вы принимаете{" "}
              <Link href={LEGAL_ROUTES.oferta} className="text-accent underline" target="_blank">
                оферту
              </Link>{" "}
              и{" "}
              <Link href={LEGAL_ROUTES.privacy} className="text-accent underline" target="_blank">
                политику персональных данных
              </Link>
              .
            </p>

            <SubmitButton />
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link className="text-accent underline" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
              Войти
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Инструктор?{" "}
            <Link className="font-medium text-accent underline" href="/instructor/apply">
              Подать заявку
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
