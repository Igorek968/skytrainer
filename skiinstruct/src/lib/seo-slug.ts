/** Кириллица → латиница для SEO-URL (без внешних зависимостей). */
const RU_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** Убирает эмодзи/символы и делает URL-slug. */
export function slugifyRu(input: string): string {
  const noEmoji = input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[()]/g, " ")
    .trim()
    .toLowerCase();
  let out = "";
  for (const ch of noEmoji) {
    if (RU_MAP[ch] !== undefined) out += RU_MAP[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/\s|_|\.|\/|,|;|:|—|–|-/.test(ch)) out += "-";
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "") || "page";
}
