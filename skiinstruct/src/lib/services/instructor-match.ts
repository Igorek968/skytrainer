/**
 * Общая логика отбора инструкторов под параметры заказа / поиска рядом.
 */

export type AvailabilitySlot = { day: number; from: string; to: string; busy?: boolean };

export function parseAvailabilitySlots(value: unknown): AvailabilitySlot[] {
  if (!Array.isArray(value)) return [];
  const result: AvailabilitySlot[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const slot = item as Record<string, unknown>;
    const day = Number(slot.day);
    const from = String(slot.from ?? "");
    const to = String(slot.to ?? "");
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) continue;
    if (from >= to) continue;
    const entry: AvailabilitySlot = { day, from, to };
    if (typeof slot.busy === "boolean") entry.busy = slot.busy;
    result.push(entry);
  }
  return result;
}

/** Дни недели (0=Вс … 6=Сб) для каждого календарного дня диапазона по строкам YYYY-MM-DD в UTC. */
export function utcCalendarWeekdaysInclusive(
  startIso: string,
  endIso: string | undefined,
  fallbackLessonDays: number,
): number[] {
  const parse = (iso: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const t0 = parse(startIso);
  if (t0 === null) return [];
  const t1Parsed = endIso ? parse(endIso) : t0;
  const t1 = t1Parsed ?? t0;
  let span = Math.floor((t1 - t0) / 86_400_000) + 1;
  if (!Number.isFinite(span) || span < 1) {
    span = Math.min(30, Math.max(1, fallbackLessonDays));
  } else {
    span = Math.min(30, Math.max(1, span));
  }
  const days: number[] = [];
  for (let i = 0; i < span; i++) {
    days.push(new Date(t0 + i * 86_400_000).getUTCDay());
  }
  return days;
}

export function weekdaysFromOrderUtcDates(
  start: Date | null,
  end: Date | null,
  fallbackLessonDays: number,
): number[] | null {
  if (!start) return null;
  const isoStart = start.toISOString().slice(0, 10);
  const isoEnd = end ? end.toISOString().slice(0, 10) : isoStart;
  return utcCalendarWeekdaysInclusive(isoStart, isoEnd, fallbackLessonDays);
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Единый каталог направлений: клиентский фильтр, анкета инструктора и отбор в `/nearby`
 * должны использовать одни и те же строки (эмодзи + текст).
 */
export const INSTRUCTOR_ACTIVITY_LABELS = [
  "🎿 Горные лыжи",
  "⛷ Сноуборд",
  "🎿 Фрирайд",
  "🚀 Гоночные дисциплины",
  "🥾 Пешие туры",
  "🚵 Маунтибайк",
  "🧒 Дети",
  "👨‍🦽 Адаптивный спорт",
  "🎾 Большой теннис",
  "🛶 Сапсёрфинг",
  "🏐 Волейбол",
] as const;

/** Привести произвольную строку к канону каталога (без эмодзи в БД / из сида тоже совпадает). */
export function canonicalizeActivityLabel(raw: string): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const n = normalizeText(t);
  if (!n) return null;
  for (const label of INSTRUCTOR_ACTIVITY_LABELS) {
    if (normalizeText(label) === n) return label;
  }
  return null;
}

/** Канонический упорядоченный список + неизвестные значения в конце (редкий ручной ввод). */
export function canonicalizeActivityLabels(raw: string[]): string[] {
  const unknown: string[] = [];
  const result: string[] = [];
  const seenCatalog = new Set<string>();

  for (const label of INSTRUCTOR_ACTIVITY_LABELS) {
    const hit = raw.some((r) => canonicalizeActivityLabel(r) === label);
    if (hit && !seenCatalog.has(label)) {
      seenCatalog.add(label);
      result.push(label);
    }
  }

  for (const r of raw) {
    const t = r?.trim();
    if (!t) continue;
    const c = canonicalizeActivityLabel(t);
    if (c) continue;
    if (!unknown.includes(t)) unknown.push(t);
  }

  return [...result, ...unknown];
}

export function toCanonicalSpecialization(value: string): string {
  const mapped = canonicalizeActivityLabel(value);
  const v = normalizeText(mapped ?? value);
  if (v.includes("пеш") || v.includes("прогул")) return "пешие туры";
  if (v.includes("маунти") || v.includes("байк") || v.includes("вел")) return "маунтибайк";
  return v;
}

function syntheticBioBodyParts(bio: string): string[] | null {
  const trimmed = bio.trim();
  const m =
    /^Инструкторка:\s*(.+)$/s.exec(trimmed) ?? /^Инструктор:\s*(.+)$/s.exec(trimmed);
  if (!m) return null;
  return m[1]
    .split(",")
    .map((x) => normalizeText(x.trim()))
    .filter(Boolean)
    .sort();
}

/** Строка «Инструкторка: …» из сида / формы, совпадающая по составу со специализациями в профиле. */
export function isSyntheticInstructorBioLine(bio: string | null | undefined, specs: string[]): boolean {
  if (!bio?.trim()) return false;
  const parts = syntheticBioBodyParts(bio);
  if (!parts?.length) return false;
  const canonSpecs = canonicalizeActivityLabels(specs)
    .map((s) => normalizeText(s))
    .sort();
  if (parts.length !== canonSpecs.length) return false;
  return parts.every((p, i) => p === canonSpecs[i]);
}

export function syncSyntheticBioLineWithSpecs(
  bio: string | null | undefined,
  prevSpecs: string[],
  nextCanonicalSpecs: string[],
): string | undefined {
  if (!bio || !isSyntheticInstructorBioLine(bio, prevSpecs)) return undefined;
  const trimmed = bio.trim();
  const prefix = trimmed.startsWith("Инструкторка:") ? "Инструкторка" : "Инструктор";
  return `${prefix}: ${nextCanonicalSpecs.join(", ")}`;
}

function isCatalogOnlyCommaListBody(body: string): boolean {
  const segments = body
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segments.length) return false;
  return segments.every((s) => canonicalizeActivityLabel(s) != null);
}

/** Если в описании осталась строка из сида «Инструкторка: А, Б, В», а специализации уже другие — подменяем текст для клиента/кабинета. */
export function repairStaleCatalogSyntheticBio(bio: string | null | undefined, specs: string[]): string {
  if (!bio?.trim()) return bio ?? "";
  const trimmed = bio.trim();
  const m = /^(Инструкторка|Инструктор):\s*(.+)$/s.exec(trimmed);
  if (!m) return trimmed;
  const prefix = m[1];
  const listBody = m[2].trim();
  if (!isCatalogOnlyCommaListBody(listBody)) return trimmed;

  const canon = canonicalizeActivityLabels(specs);
  const bodyLabels = listBody
    .split(",")
    .map((s) => canonicalizeActivityLabel(s.trim()))
    .filter((x): x is string => Boolean(x));
  const sortedCanonNorm = [...canon].map((s) => normalizeText(s)).sort();
  const sortedBodyNorm = [...bodyLabels].map((s) => normalizeText(s)).sort();
  if (
    sortedCanonNorm.length === sortedBodyNorm.length &&
    sortedCanonNorm.every((c, i) => c === sortedBodyNorm[i])
  ) {
    return trimmed;
  }
  return `${prefix}: ${canon.join(", ")}`;
}

/**
 * Совпадение направления из анкеты с выбором клиента.
 * Важно: не используем req.includes(cur) — иначе короткие теги («лыжи», «горные»)
 * ошибочно проходят для запроса «горные лыжи», хотя в профиле нет полной специализации.
 */
export function specializationMatches(available: string[], requestedRaw: string): boolean {
  const reqSource = canonicalizeActivityLabel(requestedRaw) ?? requestedRaw;
  const req = toCanonicalSpecialization(reqSource);
  if (!req) return false;
  /** Пустой список в анкете — не скрываем (инструктор ещё не отметил направления). */
  if (!available.length) return true;
  return available.some((s) => {
    const curSource = canonicalizeActivityLabel(s) ?? s;
    const cur = toCanonicalSpecialization(curSource);
    if (!cur) return false;
    return cur === req || cur.includes(req);
  });
}

/** Публичный URL файла в /public или абсолютная ссылка. */
export function normalizePublicAssetUrl(url: string | null | undefined): string | null {
  const t = url?.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return t.startsWith("/") ? t : `/${t}`;
}

function coerceStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw) as unknown;
      return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Обложка для списков: профиль, галерея, запасной аватар User.image. */
export function resolveInstructorListAvatar(input: {
  photoUrl: string | null | undefined;
  photoGallery: unknown;
  userImage: string | null | undefined;
}): string | null {
  const gallery = coerceStringArray(input.photoGallery);
  const galleryFirst = gallery.map((u) => u.trim()).find(Boolean);
  const candidates = [input.photoUrl, galleryFirst, input.userImage];
  for (const c of candidates) {
    const n = normalizePublicAssetUrl(typeof c === "string" ? c : null);
    if (n) return n;
  }
  return null;
}

export function instructorMatchesAvailability(
  availabilitySlotsJson: unknown,
  requestedWeekdays: number[] | null,
  includeOffline: boolean,
  isOnline = false,
): boolean {
  if (includeOffline || requestedWeekdays == null) return true;
  /** Сейчас в сети — доступен для ближайшей записи, не режем по шаблону дней недели. */
  if (isOnline) return true;
  const slots = parseAvailabilitySlots(availabilitySlotsJson);
  /** Пустые слоты = анкета ещё не заполнена — не скрываем онлайн-инструктора с карты. */
  if (slots.length === 0) return true;
  return requestedWeekdays.every((requiredDay) =>
    slots.some((slot) => slot.day === requiredDay && slot.busy !== true),
  );
}

/** Совпадение длительности: API («2 ч») и анкета («2 ч», «2 часа»). */
export function durationLabelMatches(offered: string[], requestedLabel: string | null): boolean {
  if (!requestedLabel || offered.length === 0) return true;
  const req = normalizeText(requestedLabel);
  return offered.some((d) => {
    const cur = normalizeText(d);
    if (cur === req) return true;
    if (req === "2 ч" && (cur === "2 часа" || cur === "2ч")) return true;
    if (req === "1 ч" && (cur === "1 час" || cur === "1ч")) return true;
    if (req === "полдня" && cur.includes("полдн")) return true;
    if (req === "день" && (cur === "день" || cur.includes("полный") || cur.includes("весь"))) return true;
    if (req.includes("день") && cur === "день") return true;
    return false;
  });
}

/** Уровень подготовки: точное совпадение или инструктор указал более высокий уровень. */
export function skillLevelMatches(offered: string[], requestedLabel: string | null): boolean {
  if (!requestedLabel || offered.length === 0) return true;
  if (offered.some((s) => s.trim() === requestedLabel)) return true;
  const rank: Record<string, number> = {
    "для начинающих": 0,
    "средний": 1,
    "продвинутый": 2,
    "эксперт": 3,
  };
  const reqRank = rank[normalizeText(requestedLabel)];
  if (reqRank === undefined) return true;
  return offered.some((s) => {
    const r = rank[normalizeText(s)];
    return r !== undefined && r >= reqRank;
  });
}
