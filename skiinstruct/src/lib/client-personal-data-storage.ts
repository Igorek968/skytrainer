export const OPEN_PERSONAL_DATA_STORAGE_KEY = "skiinstruct_open_personal";

export function markOpenPersonalDataOnNextClientVisit(): void {
  try {
    sessionStorage.setItem(OPEN_PERSONAL_DATA_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeOpenPersonalDataFlag(): boolean {
  try {
    if (sessionStorage.getItem(OPEN_PERSONAL_DATA_STORAGE_KEY) !== "1") return false;
    sessionStorage.removeItem(OPEN_PERSONAL_DATA_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
