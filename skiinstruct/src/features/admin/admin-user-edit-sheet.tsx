"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type Props = {
  userId: string;
  onClose: () => void;
};

export function AdminUserEditSheet({ userId, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [suspendedNote, setSuspendedNote] = useState("");
  const [cert, setCert] = useState("");
  const [exp, setExp] = useState("");
  const [sportsExp, setSportsExp] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");

  const query = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Не удалось загрузить");
      return r.json() as Promise<{
        user: {
          id: string;
          name: string | null;
          email: string;
          phone: string | null;
          role: string;
          suspendedAt: string | null;
          suspendedNote: string | null;
          instructorProfile: {
            isOnline: boolean;
            certificationLevel: string | null;
            experienceYears: number | null;
            sportsExperienceYears: number | null;
            age: number | null;
            bio: string | null;
            hourlyRate: number;
            payoutAccountHint: string | null;
          } | null;
        };
      }>;
    },
  });

  useEffect(() => {
    const u = query.data?.user;
    if (!u) return;
    setName(u.name ?? "");
    setEmail(u.email);
    setPhone(u.phone ?? "");
    setSuspendedNote(u.suspendedNote ?? "");
    const p = u.instructorProfile;
    if (p) {
      setCert(p.certificationLevel ?? "");
      setExp(p.experienceYears != null ? String(p.experienceYears) : "");
      setSportsExp(p.sportsExperienceYears != null ? String(p.sportsExperienceYears) : "");
      setAge(p.age != null ? String(p.age) : "");
      setBio(p.bio ?? "");
      setHourlyRate(String(p.hourlyRate));
    }
  }, [query.data?.user]);

  const save = useMutation({
    mutationFn: async (extra?: { suspended?: boolean; forceOffline?: boolean }) => {
      const u = query.data?.user;
      const body: Record<string, unknown> = {
        name: name.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        suspendedNote: suspendedNote.trim() || null,
        ...extra,
      };
      if (u?.instructorProfile) {
        body.certificationLevel = cert || null;
        body.experienceYears = exp.trim() ? Number(exp) : null;
        body.sportsExperienceYears = sportsExp.trim() ? Number(sportsExp) : null;
        body.age = age.trim() ? Number(age) : null;
        body.bio = bio.trim() || null;
        if (hourlyRate.trim()) body.hourlyRate = Number(hourlyRate);
      }
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Ошибка");
      return j;
    },
    onSuccess: async () => {
      toast.success("Сохранено");
      await qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      await qc.invalidateQueries({ queryKey: ["admin-users-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const u = query.data?.user;
  const suspended = Boolean(u?.suspendedAt);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Профиль пользователя</h2>
            <p className="text-xs text-muted-foreground">{u?.role ?? "…"}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : !u ? (
          <p className="text-sm text-destructive">Не найден.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {suspended ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs">
                Заблокирован с {new Date(u.suspendedAt!).toLocaleString("ru-RU")}
              </p>
            ) : null}
            <div className="space-y-1">
              <Label>Имя</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Телефон</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Комментарий блокировки</Label>
              <Input
                value={suspendedNote}
                onChange={(e) => setSuspendedNote(e.target.value)}
                placeholder="Причина…"
              />
            </div>

            {u.instructorProfile ? (
              <div className="space-y-2 rounded-md border border-border p-2">
                <p className="text-xs font-medium text-muted-foreground">Анкета инструктора</p>
                {u.instructorProfile.payoutAccountHint ? (
                  <p className="text-xs">Реквизиты: {u.instructorProfile.payoutAccountHint}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Категория</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={cert}
                      onChange={(e) => setCert(e.target.value)}
                    >
                      <option value="">—</option>
                      {["A", "B", "C", "D"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ставка</Label>
                    <Input value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Стаж (лет)</Label>
                    <Input value={exp} onChange={(e) => setExp(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Спорт. стаж</Label>
                    <Input value={sportsExp} onChange={(e) => setSportsExp(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Возраст</Label>
                    <Input value={age} onChange={(e) => setAge(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">О себе</Label>
                  <textarea
                    className="min-h-[64px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="accent"
                disabled={save.isPending}
                onClick={() => save.mutate({})}
              >
                Сохранить
              </Button>
              {u.instructorProfile?.isOnline ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ forceOffline: true })}
                >
                  Снять с линии
                </Button>
              ) : null}
              {suspended ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ suspended: false })}
                >
                  Разблокировать
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => {
                    if (confirm("Заблокировать пользователя (soft-ban)?")) {
                      save.mutate({ suspended: true });
                    }
                  }}
                >
                  Заблокировать
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
