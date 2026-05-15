"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { formatRussianPhoneDisplay } from "@/lib/phone";

type MeProfile = {
  name: string | null;
  email: string;
  phone?: string | null;
  birthDate: string | null;
};

export function HeaderAccountHint() {
  const { status } = useSession();
  const { data } = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => {
      const r = await fetch("/api/me/profile");
      if (r.status === 401 || !r.ok) return null;
      return r.json() as Promise<MeProfile>;
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });

  if (status !== "authenticated" || !data) return null;

  const contactLine = data.phone
    ? formatRussianPhoneDisplay(data.phone)
    : data.email;
  const nameLine = data.name?.trim() || "Ф.И.О. не указано";
  const birthLine = data.birthDate
    ? new Date(`${data.birthDate}T12:00:00`).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <p className="max-w-[min(320px,70vw)] text-[11px] leading-snug text-muted-foreground">
      Владелец аккаунта: {nameLine}
      <span className="text-muted-foreground/80"> · {contactLine}</span>
      {birthLine ? <span className="text-muted-foreground/80"> · д.р. {birthLine}</span> : null}
    </p>
  );
}
