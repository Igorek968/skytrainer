"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { REFERRAL_MAX_ORDERS_PER_CLIENT, REFERRAL_REWARD_RUB } from "@/lib/legal-config";
import { ShareReferralButton } from "@/features/share/share-referral-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

type ReferralMe = {
  referralLink: string;
};

export function ReferralInviteCta({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["referral-me"],
    queryFn: async () => {
      const r = await fetch("/api/referral/me", { credentials: "include" });
      if (!r.ok) return null;
      return r.json() as Promise<ReferralMe>;
    },
    staleTime: 60_000,
  });

  if (isLoading || !data?.referralLink) return null;

  if (compact) {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <p className="font-medium">Понравилось? Пригласите друга</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {REFERRAL_REWARD_RUB} ₽ за каждый из первых {REFERRAL_MAX_ORDERS_PER_CLIENT} заказов друга.
        </p>
        <ShareReferralButton referralLink={data.referralLink} variant="accent" size="sm" className="mt-2" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Пригласите друга</CardTitle>
        <CardDescription>
          Поделитесь ссылкой — получайте {REFERRAL_REWARD_RUB} ₽ за каждый из первых{" "}
          {REFERRAL_MAX_ORDERS_PER_CLIENT} завершённых заказов приглашённого клиента.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <ShareReferralButton referralLink={data.referralLink} variant="accent" showCopyButton />
        <Link href="/client/referral" className="text-xs text-muted-foreground underline underline-offset-2">
          Подробнее о программе
        </Link>
      </CardContent>
    </Card>
  );
}
