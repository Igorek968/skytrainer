"use client";

import { useRouter } from "next/navigation";

/** Возврат на форму регистрации/оплаты, с которой открыли документ. */
export function LegalDocBackLink() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="text-accent underline underline-offset-2"
      onClick={() => router.back()}
    >
      ← Назад
    </button>
  );
}
