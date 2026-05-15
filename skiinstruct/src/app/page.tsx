import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/shared/ui/button";

export default async function HomePage() {
  const session = await auth();
  if (session?.user.role === "INSTRUCTOR") redirect("/instructor");
  if (session?.user.role === "ADMIN") redirect("/admin/activity");
  if (session?.user.role === "CLIENT") redirect("/client");

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto max-w-lg space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium text-accent">Горнолыжный курорт</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Инструктор <span className="text-accent">для тебя</span>
          </h1>
          <p className="text-pretty text-muted-foreground md:text-lg">
            Закажите урок: точка встречи, уровень и удобное время — рядом с вами на курорте.
          </p>
        </div>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button variant="accent" size="lg" className="min-w-[200px]" asChild>
            <Link href="/client">Выбрать инструктора</Link>
          </Button>
          <Button variant="outline" size="lg" className="min-w-[200px]" asChild>
            <Link href="/login">Войти</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <Link className="font-medium text-accent underline" href="/register">
            Регистрация по email
          </Link>
        </p>
      </div>
    </div>
  );
}
