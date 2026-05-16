import { redirect } from "next/navigation";

import ClientHomePage from "@/app/client/page";
import { auth } from "@/auth";

/** Главная = поиск на карте без барьеров; кабинеты ролей — по прямым URL. */
export default async function HomePage() {
  const session = await auth();
  if (session?.user.role === "INSTRUCTOR") redirect("/instructor");
  if (session?.user.role === "ADMIN") redirect("/admin/activity");

  return <ClientHomePage />;
}
