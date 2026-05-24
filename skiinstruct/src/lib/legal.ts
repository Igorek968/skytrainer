/**
 * Оператор сервиса для юридических страниц (задаётся в env на проде).
 * TODO перед коммерческим запуском: юрист + NEXT_PUBLIC_LEGAL_ENTITY_NAME — см. LAUNCH_CHECKLIST.md
 */
export function legalOperatorName(): string {
  return (
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() ||
    "оператор программного сервиса «Инструктор для тебя» (реквизиты уточняются у администрации)"
  );
}

export const LEGAL_ROUTES = {
  oferta: "/oferta",
  ofertaInstructor: "/oferta-instructor",
  privacy: "/privacy",
  returns: "/returns",
  support: "/support",
} as const;
