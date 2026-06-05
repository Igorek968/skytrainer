import { LEGAL_AGENT } from "@/lib/legal-entity";

/**
 * Оператор сервиса для юридических страниц (задаётся в env на проде).
 */
export function legalOperatorName(): string {
  return process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || LEGAL_AGENT.shortName;
}

export const LEGAL_ROUTES = {
  oferta: "/oferta",
  ofertaInstructor: "/oferta-instructor",
  privacy: "/privacy",
  returns: "/returns",
  requisites: "/requisites",
  support: "/support",
} as const;
