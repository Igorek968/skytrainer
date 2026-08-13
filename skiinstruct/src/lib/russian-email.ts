/**
 * Политика email для регистрации на площадке (РФ).
 *
 * По 406-ФЗ / ст. 13.55 КоАП (с 07.07.2026): запрещена авторизация через иностранные
 * сервисы идентификации (Google ID, Apple ID и т.п.). Рекомендуемые способы входа —
 * РФ-номер, Госуслуги, российские ID-провайдеры и др.
 *
 * Email как логин при собственной проверке пароля формально не равен «иностранному SSO»,
 * но для инструкторов площадка принимает только российские почтовые домены —
 * чтобы подтверждение писем и коммуникация шли через доступные в РФ сервисы.
 */

const KNOWN_RU_MAILBOX_DOMAINS = new Set(
  [
    "mail.ru",
    "inbox.ru",
    "list.ru",
    "bk.ru",
    "internet.ru",
    "yandex.ru",
    "yandex.com",
    "ya.ru",
    "narod.ru",
    "rambler.ru",
    "lenta.ru",
    "autorambler.ru",
    "myrambler.ru",
    "ro.ru",
    "vk.com",
    "ok.ru",
  ].map((d) => d.toLowerCase()),
);

export const RUSSIAN_EMAIL_HINT =
  "Укажите почту российского сервиса: Mail.ru, Яндекс, Rambler или другой адрес на домене .ru / .рф. Gmail, Outlook, iCloud и зарубежные почты не принимаются.";

export const RUSSIAN_EMAIL_EXAMPLES = "например: name@mail.ru, name@yandex.ru, name@rambler.ru";

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
}

/** Punycode .рф → xn--p1ai уже в hostname; принимаем и unicode. */
function isRussianTldDomain(domain: string): boolean {
  return (
    domain.endsWith(".ru") ||
    domain.endsWith(".su") ||
    domain.endsWith(".рф") ||
    domain.endsWith(".xn--p1ai")
  );
}

export function isAllowedRussianEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain || !domain.includes(".")) return false;
  if (KNOWN_RU_MAILBOX_DOMAINS.has(domain)) return true;
  // Корпоративная / своя почта на российских зонах
  if (isRussianTldDomain(domain)) return true;
  return false;
}

export function assertRussianEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@")) return "Укажите корректный email";
  if (!isAllowedRussianEmail(trimmed)) {
    return `Нельзя зарегистрироваться с этой почтой. ${RUSSIAN_EMAIL_HINT}`;
  }
  return null;
}
