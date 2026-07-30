/** Реквизиты исполнителя (клиентская оферта, политика ПДн, возвраты). */
export const LEGAL_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://твойтренер.рф";

export const LEGAL_AGENT = {
  fullName: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ТВОЙТРЕНЕР"',
  shortName: "ООО «ТВОЙТРЕНЕР»",
  inn: "2378001540",
  kpp: "237801001",
  ogrn: "1262300030640",
  email: "tvoitrenerrf@yandex.ru",
  bankAccount: "40702810220000343478",
  bankName: 'ООО "Банк Точка"',
  bik: "044525104",
  corrAccount: "30101810745374525104",
  agentFeePercent: 15,
} as const;

/** Юридический адрес оператора; переопределяется через NEXT_PUBLIC_LEGAL_ADDRESS. */
export const LEGAL_REGISTERED_ADDRESS_DEFAULT =
  "354375, Краснодарский край, Сочи, Урожайная улица, 35/2";

export function legalRegisteredAddress(): string {
  return process.env.NEXT_PUBLIC_LEGAL_ADDRESS?.trim() || LEGAL_REGISTERED_ADDRESS_DEFAULT;
}
