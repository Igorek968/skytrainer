"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ShareReferralButton } from "@/features/share/share-referral-button";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type ReferralMe = {
  referralLink: string;
  referralCode: string;
  balanceRub: number;
  invitedCount: number;
  rewardsCount: number;
  earnedTotalRub: number;
  rewardPerOrderRub: number;
  maxOrdersPerInvitee: number;
  programEndsAt: string;
  cookieHelpText: string;
  payoutMinRub: number;
  canWithdraw: boolean;
  payoutAccountHint: string | null;
  recentRewards: Array<{
    id: string;
    amountRub: number;
    orderIndex: number;
    createdAt: string;
  }>;
  payoutRequests: Array<{
    id: string;
    amountRub: number;
    status: string;
    adminNote: string | null;
    createdAt: string;
  }>;
};

export function ReferralProgramPanel({
  showClientPayoutHintForm = false,
}: {
  showClientPayoutHintForm?: boolean;
}) {
  const [data, setData] = useState<ReferralMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [payoutHint, setPayoutHint] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/referral/me", { credentials: "include" });
      const j = (await res.json()) as ReferralMe & { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Не удалось загрузить данные");
        return;
      }
      setData(j);
      setPayoutHint(j.payoutAccountHint ?? "");
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePayoutHint() {
    setPending(true);
    try {
      const res = await fetch("/api/referral/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutAccountHint: payoutHint }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Не удалось сохранить реквизиты");
        return;
      }
      toast.success("Реквизиты сохранены");
      await load();
    } finally {
      setPending(false);
    }
  }

  async function requestPayout() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/referral/payout-request", {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Не удалось создать заявку");
        return;
      }
      toast.success("Заявка на вывод отправлена");
      await load();
    } finally {
      setPending(false);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  if (!data) {
    return error ? <p className="text-sm text-destructive">{error}</p> : null;
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Приглашайте друзей по ссылке: за каждый из первых {data.maxOrdersPerInvitee} завершённых
        оплаченных заказов приглашённого клиента — {data.rewardPerOrderRub} ₽ на ваш баланс. Программа
        действует до {new Date(data.programEndsAt).toLocaleDateString("ru-RU")}. {data.cookieHelpText}
      </p>

      <div className="space-y-2">
        <Label htmlFor="referral-link">Ваша ссылка</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input id="referral-link" readOnly value={data.referralLink} className="font-mono text-xs" />
          <ShareReferralButton referralLink={data.referralLink} showCopyButton />
        </div>
        <p className="text-xs text-muted-foreground">
          Код: {data.referralCode}. Ссылка фиксируется и не меняется до окончания программы.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="text-xs text-muted-foreground">Баланс</div>
          <div className="text-lg font-semibold">{data.balanceRub.toFixed(0)} ₽</div>
        </div>
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="text-xs text-muted-foreground">Заработано всего</div>
          <div className="text-lg font-semibold">{data.earnedTotalRub.toFixed(0)} ₽</div>
        </div>
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="text-xs text-muted-foreground">Приглашено</div>
          <div className="font-medium">{data.invitedCount}</div>
        </div>
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="text-xs text-muted-foreground">Начислений</div>
          <div className="font-medium">{data.rewardsCount}</div>
        </div>
      </div>

      {showClientPayoutHintForm ? (
        <div className="space-y-2 border-t border-border pt-3">
          <Label htmlFor="referral-payout-hint">Реквизиты для вывода (карта / счёт)</Label>
          <Input
            id="referral-payout-hint"
            value={payoutHint}
            onChange={(e) => setPayoutHint(e.target.value)}
            placeholder="Например: карта ··· 1234"
            maxLength={64}
          />
          <Button type="button" variant="outline" disabled={pending} onClick={() => void savePayoutHint()}>
            Сохранить реквизиты
          </Button>
        </div>
      ) : data.payoutAccountHint ? (
        <p className="text-xs text-muted-foreground">Реквизиты: {data.payoutAccountHint}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Укажите реквизиты для выплат в разделе «Соответствие и выплаты».
        </p>
      )}

      <div className="border-t border-border pt-3">
        <Button
          type="button"
          variant="accent"
          disabled={!data.canWithdraw || pending}
          onClick={() => void requestPayout()}
        >
          {pending ? "Отправка…" : "Вывести реферальный баланс"}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">Минимум к выводу: {data.payoutMinRub} ₽</p>
        {error ? <p className="mt-2 text-destructive">{error}</p> : null}
      </div>

      {data.payoutRequests.length ? (
        <div className="space-y-2 text-xs">
          <p className="font-medium">Заявки на вывод</p>
          {data.payoutRequests.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
              {r.amountRub.toFixed(0)} ₽ — {r.status}
              {r.adminNote ? <div className="text-muted-foreground">{r.adminNote}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {data.recentRewards.length ? (
        <div className="space-y-2 text-xs">
          <p className="font-medium">Последние начисления</p>
          {data.recentRewards.map((r) => (
            <div key={r.id} className="rounded-md border border-border px-2 py-1.5">
              +{r.amountRub.toFixed(0)} ₽ · заказ {r.orderIndex}/{data.maxOrdersPerInvitee} ·{" "}
              {new Date(r.createdAt).toLocaleDateString("ru-RU")}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
