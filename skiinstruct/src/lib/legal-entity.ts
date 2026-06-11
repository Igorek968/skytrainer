/** Реквизиты агента (клиентская оферта, политика ПДн, возвраты). */
export const LEGAL_SITE_URL = "https://utrainer.ru";

export const LEGAL_AGENT = {
  fullName: "Индивидуальный предприниматель Ершов Андрей Валерьевич",
  shortName: "ИП Ершов Андрей Валерьевич",
  inn: "110116757261",
  ogrn: "323112100004244",
  email: "berezka23igor@yandex.ru",
  bankAccount: "40817810500003053681",
  bankName: "АО «ТБанк»",
  bik: "044525974",
  corrAccount: "30101810145250000974",
  agentFeePercent: 15,
} as const;

export function legalRegisteredAddress(): string {
  return process.env.NEXT_PUBLIC_LEGAL_ADDRESS?.trim() || "Республика Коми, г. Сыктывкар";
}
