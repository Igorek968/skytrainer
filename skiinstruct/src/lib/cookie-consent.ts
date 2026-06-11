import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
} from "@/lib/legal-config";

export { COOKIE_CONSENT_COOKIE_NAME, COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_VERSION };

const CONSENT_MAX_AGE_SEC = 365 * 24 * 60 * 60;

export function hasCookieConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === COOKIE_CONSENT_VERSION) return true;
    return document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`));
  } catch {
    return false;
  }
}

export function acceptCookieConsent(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_VERSION);
  } catch {
    /* ignore */
  }
  const secure = window.location.protocol === "https:";
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${COOKIE_CONSENT_VERSION}; path=/; max-age=${CONSENT_MAX_AGE_SEC}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
