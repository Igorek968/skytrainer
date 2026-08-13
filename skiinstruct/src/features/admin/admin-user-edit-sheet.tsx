"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { formatRussianPhoneDisplay } from "@/lib/phone";
import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

type DocRow = {
  id: string;
  type: string;
  typeLabel: string;
  status: string;
  rejectNote: string | null;
  createdAt: string;
  viewUrl: string | null;
  fileMissing?: boolean;
};

type UserPayload = {
  id: string;
  name: string | null;
  middleName: string | null;
  nickname: string | null;
  email: string;
  phone: string | null;
  birthDate: string | null;
  role: string;
  suspendedAt: string | null;
  suspendedNote: string | null;
  anketaComplete: boolean;
  missingFields: string[];
  instructorProfile: {
    isOnline: boolean;
    verificationStatus: string;
    certificationLevel: string | null;
    experienceYears: number | null;
    sportsExperienceYears: number | null;
    age: number | null;
    bio: string | null;
    hourlyRate: number;
    specializations: string[];
    payoutAccountHint: string | null;
    inn: string | null;
    taxStatus: "SELF_EMPLOYED" | "IP" | null;
    agencyOfferAcceptedAt: string | null;
    agencyOfferVersion: string | null;
    passportSeries: string | null;
    passportNumber: string | null;
    passportIssuedAt: string | null;
    passportDepartmentCode: string | null;
  } | null;
  documents: DocRow[];
};

type Props = {
  userId: string;
  onClose: () => void;
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{value?.trim() || "—"}</dd>
    </div>
  );
}

function taxLabel(status: string | null | undefined): string {
  if (status === "IP") return "ИП (ЕГРИП)";
  if (status === "SELF_EMPLOYED") return "Самозанятый (НПД / «Мой налог»)";
  return "—";
}

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
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Не удалось загрузить");
      return r.json() as Promise<{ user: UserPayload }>;
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
    setSelectedDocs(
      new Set((u.documents ?? []).filter((d) => d.status === "PENDING").map((d) => d.id)),
    );
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

  const approve = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/instructors/${userId}/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "APPROVED",
          approveDocumentIds: [...selectedDocs],
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string | object };
      if (!r.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Не удалось одобрить");
      }
      return j;
    },
    onSuccess: async () => {
      toast.success("Анкета одобрена — в списке появится зелёная звезда");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-user", userId] }),
        qc.invalidateQueries({ queryKey: ["admin-users-list"] }),
        qc.invalidateQueries({ queryKey: ["admin-overview"] }),
        qc.invalidateQueries({ queryKey: ["admin-compliance-pending"] }),
      ]);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const u = query.data?.user;
  const suspended = Boolean(u?.suspendedAt);
  const isInstructor = u?.role === "INSTRUCTOR" && Boolean(u.instructorProfile);
  const alreadyApproved = u?.instructorProfile?.verificationStatus === "APPROVED";

  const fullName = useMemo(() => {
    if (!u) return "";
    const parts = [u.name, u.middleName].filter(Boolean);
    return parts.join(" ").trim() || u.email;
  }, [u]);

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg">
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Профиль пользователя</h2>
            <p className="text-xs text-muted-foreground">{u?.role ?? "…"}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : !u ? (
            <p className="text-sm text-destructive">Не найден.</p>
          ) : (
            <div className="space-y-4 text-sm">
              {suspended ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs">
                  Заблокирован с {new Date(u.suspendedAt!).toLocaleString("ru-RU")}
                </p>
              ) : null}

              {isInstructor ? (
                <>
                  <div
                    className={cn(
                      "rounded-md border px-3 py-2 text-xs",
                      alreadyApproved && u.anketaComplete
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : !u.anketaComplete
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                          : "border-border bg-muted/30 text-muted-foreground",
                    )}
                  >
                    {alreadyApproved ? (
                      <p className="font-medium">★ Проверка пройдена — анкета одобрена</p>
                    ) : !u.anketaComplete ? (
                      <>
                        <p className="font-medium">Жёлтый статус: анкета неполная</p>
                        <p className="mt-1">Не хватает: {u.missingFields.join(", ")}</p>
                      </>
                    ) : (
                      <p className="font-medium">Данные для договора заполнены — можно одобрить</p>
                    )}
                  </div>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Данные для договора</h3>
                    <dl className="grid gap-3 rounded-md border border-border bg-muted/15 p-3 sm:grid-cols-2">
                      <Field label="ФИО" value={fullName} />
                      <Field label="Никнейм" value={u.nickname} />
                      <Field label="Email" value={u.email} />
                      <Field
                        label="Телефон"
                        value={u.phone ? formatRussianPhoneDisplay(u.phone) : null}
                      />
                      <Field label="Дата рождения" value={u.birthDate} />
                      <Field label="ИНН" value={u.instructorProfile?.inn} />
                      <Field
                        label="Налоговый статус"
                        value={taxLabel(u.instructorProfile?.taxStatus)}
                      />
                      <Field
                        label="Акцепт оферты"
                        value={
                          u.instructorProfile?.agencyOfferAcceptedAt
                            ? `${formatInAppTimeZone(u.instructorProfile.agencyOfferAcceptedAt)} · v${u.instructorProfile.agencyOfferVersion ?? "—"}`
                            : null
                        }
                      />
                      <Field label="Серия паспорта" value={u.instructorProfile?.passportSeries} />
                      <Field label="Номер паспорта" value={u.instructorProfile?.passportNumber} />
                      <Field label="Дата выдачи" value={u.instructorProfile?.passportIssuedAt} />
                      <Field
                        label="Код подразделения"
                        value={u.instructorProfile?.passportDepartmentCode}
                      />
                      <Field
                        label="Реквизиты выплат"
                        value={u.instructorProfile?.payoutAccountHint}
                      />
                      <Field
                        label="Направления"
                        value={u.instructorProfile?.specializations?.join(", ") || null}
                      />
                    </dl>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Документы (паспорт, НПД/ЕГРИП)</h3>
                    {(u.documents?.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground">Файлы ещё не загружены</p>
                    ) : (
                      <ul className="space-y-2">
                        {u.documents.map((d) => (
                          <li
                            key={d.id}
                            className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="font-medium">
                                {d.typeLabel}{" "}
                                <span className="text-xs text-muted-foreground">({d.status})</span>
                              </p>
                              {d.rejectNote ? (
                                <p className="text-xs text-muted-foreground">Отклонение: {d.rejectNote}</p>
                              ) : null}
                              {d.viewUrl ? (
                                <a
                                  className="text-xs text-accent underline"
                                  href={d.viewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Открыть файл
                                </a>
                              ) : d.fileMissing ? (
                                <p className="text-xs text-destructive">
                                  Файл отсутствует на сервере — попросите инструктора загрузить снова.
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">Ссылка на файл недоступна</p>
                              )}
                            </div>
                            {d.status === "PENDING" ? (
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={selectedDocs.has(d.id)}
                                  onChange={() => toggleDoc(d.id)}
                                />
                                Одобрить вместе
                              </label>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    <a
                      className="inline-block text-xs text-accent underline"
                      href={`/api/admin/agency-registry/${userId}/certificate`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Открыть заполненный агентский договор
                    </a>
                  </section>
                </>
              ) : null}

              <div className="space-y-2 rounded-md border border-border p-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {isInstructor ? "Правки профиля (необязательно)" : "Профиль"}
                </p>
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
                  <div className="grid grid-cols-2 gap-2 pt-1">
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
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">О себе</Label>
                      <textarea
                        className="min-h-[64px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {u ? (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            {isInstructor ? (
              <Button
                type="button"
                variant="accent"
                disabled={
                  approve.isPending ||
                  alreadyApproved ||
                  !u.anketaComplete ||
                  save.isPending
                }
                title={
                  !u.anketaComplete
                    ? "Сначала должны быть заполнены все поля договора"
                    : alreadyApproved
                      ? "Уже одобрено"
                      : undefined
                }
                onClick={() => approve.mutate()}
              >
                {alreadyApproved
                  ? "Уже одобрено ★"
                  : selectedDocs.size > 0
                    ? `Одобрить (+${selectedDocs.size} док.)`
                    : "Одобрить"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="accent"
                disabled={save.isPending}
                onClick={() => save.mutate({})}
              >
                Сохранить
              </Button>
            )}
            {isInstructor ? (
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending || approve.isPending}
                onClick={() => save.mutate({})}
              >
                Сохранить правки
              </Button>
            ) : null}
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
        ) : null}
      </div>
    </div>
  );
}
