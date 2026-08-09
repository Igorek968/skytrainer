/**
 * Приёмник outbound-webhook’ов сайта → посты в Telegram-канал.
 * Формат как у telegram_news_bot: фото + HTML caption + кнопка CTA.
 * Контракт: skiinstruct/BOT_API.md
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const PORT = Number(process.env.PORT || 8787);
const BOT_API_SECRET = (process.env.BOT_API_SECRET || "").trim();
const BOT_TOKEN = (process.env.BOT_TOKEN || "").trim();
const CHANNEL_ID = (process.env.CHANNEL_ID || "@tvoitrenerrf").trim();
const SITE_URL = (process.env.SITE_URL || "https://xn--b1agaovdpdkd.xn--p1ai").replace(/\/+$/, "");
const DEFAULT_PHOTO_URL =
  process.env.DEFAULT_PHOTO_URL?.trim() ||
  `${SITE_URL}/brand/logo-sign-photo.png`;
const DEFAULT_PHOTO_FILE =
  process.env.DEFAULT_PHOTO_FILE?.trim() || "/brand/logo-sign-photo.png";
/** По очереди: логотип намерче (куртка) или на штендере/фоне тренировки — рисует AI в кадре, без наклейки поверх */
let brandPlacementTick = 0;

/** Официальный логотип сайта (logo-tvoytrener-official.png) — описание для image model */
const OFFICIAL_LOGO_DESC =
  "exact official ТвойТренер brand mark from the website: two head-and-shoulders silhouettes facing right " +
  "(larger front figure teal/muted green, smaller rear figure dark navy), white winding path through the teal figure, " +
  "and the Cyrillic wordmark ТвойТренер beside/under the icon (Твой in teal, Тренер in navy), clean sans-serif, no .рф in the mark";
const PROVOD_API_KEY = (process.env.PROVOD_API_KEY || "").trim();
const PROVOD_BASE_URL = (process.env.PROVOD_BASE_URL || "https://api.provod.ai").replace(
  /\/+$/,
  "",
);
const TEXT_MODEL = (process.env.TEXT_MODEL || "openai/gpt-5.4").trim();
const IMAGE_MODEL = (process.env.IMAGE_MODEL || "google/gemini-3.1-flash-image").trim();
const CTA_BUTTON = "Подобрать тренера → ТвойТренер.рф";
/** Набор реакций канала (нативные в TG) — дублируем в подписи для вовлечения */
const REACTION_EMOJIS = "🔥 ❤️ 🥱 ⛺ 💥";
const COMMENT_HINT =
  "💬 Комментарии открыты — напишите мнение под постом";

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function unauthorized(res) {
  json(res, 401, { error: "Unauthorized" });
}

function authorize(req) {
  if (!BOT_API_SECRET) return false;
  return (req.headers.authorization || "") === `Bearer ${BOT_API_SECRET}`;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function siteLink(pathOrUrl, campaign) {
  let url;
  try {
    url = new URL(
      /^https?:\/\//i.test(pathOrUrl || "")
        ? pathOrUrl
        : `${SITE_URL}${pathOrUrl?.startsWith("/") ? pathOrUrl : `/${pathOrUrl || ""}`}`,
    );
  } catch {
    url = new URL(SITE_URL);
  }
  url.searchParams.set("utm_source", "tg");
  url.searchParams.set("utm_medium", "post");
  url.searchParams.set("utm_campaign", campaign || "channel");
  return url.toString();
}

function ctaKeyboard(url) {
  return { inline_keyboard: [[{ text: CTA_BUTTON, url }]] };
}

function sportEmoji(sport) {
  const s = String(sport || "").toLowerCase();
  if (/баскет|basket/.test(s)) return "🏀";
  if (/футбол|football|soccer/.test(s)) return "⚽";
  if (/теннис|tennis/.test(s)) return "🎾";
  if (/плав|swim/.test(s)) return "🏊";
  if (/лыж|ski|сноу|snow/.test(s)) return "🎿";
  if (/йог|yoga/.test(s)) return "🧘";
  if (/бег|run|атлет/.test(s)) return "🏃";
  if (/бокс|box|mma|единобор/.test(s)) return "🥊";
  if (sport && /[\u{1F300}-\u{1FAFF}]/u.test(String(sport))) {
    const m = String(sport).match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    if (m) return m[0];
  }
  return "🏅";
}

/** Шаблон caption как в старых постах канала + реакции/комменты внизу. */
function buildCaption({ leadEmoji, title, body, tip, tipLabel = "Важно", ctaLead, siteHref }) {
  const tipBlock = tip
    ? `\n\n⚠️ <b>${esc(tipLabel)}:</b> ${esc(tip)}`
    : "";
  const cta =
    ctaLead ||
    `Хотите подготовиться и выступить лучше? Наши тренеры на <a href="${esc(siteHref)}">ТвойТренер.рф</a> помогут!`;
  return [
    `${leadEmoji} <b>${esc(title)}</b>`,
    "",
    esc(body),
    tipBlock,
    "",
    cta,
    "👇 Подобрать тренера на сайте",
    "",
    REACTION_EMOJIS,
    COMMENT_HINT,
  ]
    .filter((x, i, arr) => !(x === "" && arr[i - 1] === ""))
    .join("\n")
    .slice(0, 1024);
}

function nextBrandPlacement() {
  brandPlacementTick += 1;
  return brandPlacementTick % 2 === 1 ? "merch" : "backdrop";
}

function brandSceneHint(placement) {
  const logo = OFFICIAL_LOGO_DESC;
  if (placement === "backdrop") {
    return (
      `Photorealistic sports coaching scene in Sochi / Adler / Sirius, natural daylight. ` +
      `Primary brand: white A-frame sandwich-board (штендер) or wall banner standing in the training area, ` +
      `with the ${logo} printed clearly on it as physical signage. ` +
      `Athletes/coach nearby without large logo on clothing. ` +
      `Logo must look printed on the sign — NOT a digital corner watermark, NOT a website UI plate, NOT a floating sticker.`
    );
  }
  return (
    `Photorealistic lifestyle coaching photo in Sochi / Adler / Sirius seaside or training area, natural daylight. ` +
    `Coach seen from behind or three-quarter back in a white zip athletic jacket; ` +
    `the ${logo} is printed LARGE on the jacket BACK as a fabric print (merch), readable and sharp. ` +
    `Optional small matching logo on a distant banner only. ` +
    `Logo must look printed on fabric — NOT a digital corner watermark, NOT a website UI plate, NOT a floating sticker.`
  );
}

function buildImagePrompt(base, placement) {
  const scene = brandSceneHint(placement);
  const core = (base || "").trim();
  // сцена с брендом важнее свободного image_prompt от текста
  const joined = core
    ? `${scene} Scene topic: ${core.slice(0, 280)}`
    : scene;
  return `${joined} Square composition. High-end brand campaign photo.`.slice(0, 1200);
}

async function provodComplete(system, user) {
  if (!PROVOD_API_KEY) return null;
  try {
    const res = await fetch(`${PROVOD_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PROVOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[channel-bot] provod", res.status, JSON.stringify(data).slice(0, 300));
      return null;
    }
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("[channel-bot] provod fail", e instanceof Error ? e.message : e);
    return null;
  }
}

async function enrichWithProvod(kind, facts) {
  const system = `Ты редактор Telegram-канала маркетплейса инструкторов «ТвойТренер.рф» (Сочи, Красная Поляна, Сириус, Россия).
Пиши по-русски, живо, без воды и без выдуманных фактов.
Ответь СТРОГО JSON без markdown:
{"title":"...","body":"1-2 предложения","tip":"короткий совет","lead_emoji":"один эмодзи","image_prompt":"English short scene topic only (sport, place, action). Do NOT describe logos — branding is added separately"}`;
  const user = `Тип поста: ${kind}\nФакты:\n${JSON.stringify(facts, null, 2)}`;
  const raw = await provodComplete(system, user);
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.warn("[channel-bot] provod JSON parse fail", raw.slice(0, 200));
    return null;
  }
}

/** Генерация картинки через Provod (OpenAI-compatible images API), как раньше в telegram_news_bot. */
async function provodGenerateImage(prompt) {
  if (!PROVOD_API_KEY || !prompt?.trim()) return null;
  try {
    const res = await fetch(`${PROVOD_BASE_URL}/v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PROVOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      // gemini image на Provod: size / response_format=url → 400; b64 без size — ок
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: prompt.trim().slice(0, 1200),
        n: 1,
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[channel-bot] provod image", res.status, JSON.stringify(data).slice(0, 400));
      return null;
    }
    const item = data.data?.[0];
    if (item?.b64_json) {
      const buf = Buffer.from(item.b64_json, "base64");
      if (buf.length > 100) return { buf, ct: "image/png", name: "provod.png" };
    }
    if (item?.url) {
      return downloadPhoto(item.url);
    }
    console.warn("[channel-bot] provod image empty response");
    return null;
  } catch (e) {
    console.error("[channel-bot] provod image fail", e instanceof Error ? e.message : e);
    return null;
  }
}

async function tgApi(method, body) {
  if (!BOT_TOKEN) {
    console.warn("[channel-bot] BOT_TOKEN empty");
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.error(`[channel-bot] ${method} failed`, res.status, data);
    }
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[channel-bot] ${method} network`, msg);
    return { ok: false, error: msg };
  }
}

async function loadLocalPhoto(path) {
  try {
    const buf = await readFile(path);
    if (buf.length < 100) return null;
    const name = basename(path).toLowerCase();
    const ct = name.endsWith(".png") ? "image/png" : "image/jpeg";
    return { buf, ct, name: basename(path) };
  } catch {
    return null;
  }
}

async function downloadPhoto(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100 || buf.length > 9_500_000) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    return { buf, ct, name: "photo.jpg" };
  } catch (e) {
    console.warn("[channel-bot] download photo fail", e instanceof Error ? e.message : e);
    return null;
  }
}

async function tgSendPhotoUpload(
  caption,
  reply_markup,
  { photoUrl, photoFile, imagePrompt } = {},
) {
  if (!BOT_TOKEN) return { ok: false, skipped: true };

  const files = [];
  // 1) сгенерированное Provod (как раньше)
  if (imagePrompt) {
    const gen = await provodGenerateImage(imagePrompt);
    if (gen) files.push(gen);
  }
  // 2) готовое фото с сайта / URL
  if (photoUrl?.startsWith("http")) {
    const d = await downloadPhoto(photoUrl);
    if (d) files.push(d);
  }
  // 3) локальный бренд-fallback
  const local = await loadLocalPhoto(DEFAULT_PHOTO_FILE);
  if (local) files.push(local);
  if (photoFile) files.push(photoFile);
  if (DEFAULT_PHOTO_URL && files.length === 0) {
    const d = await downloadPhoto(DEFAULT_PHOTO_URL);
    if (d) files.push(d);
  }

  for (const file of files) {
    // Без наклейки поверх фото: бренд уже в AI-кадре (мерч / штендер)
    const form = new FormData();
    form.set("chat_id", CHANNEL_ID);
    form.set("caption", caption);
    form.set("parse_mode", "HTML");
    form.set("reply_markup", JSON.stringify(reply_markup));
    const ext = file.ct.includes("png") ? "png" : "jpg";
    form.set(
      "photo",
      new Blob([file.buf], { type: file.ct }),
      file.name || `photo.${ext}`,
    );
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(45_000),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) return data;
      console.error("[channel-bot] sendPhoto upload failed", data);
    } catch (e) {
      console.error("[channel-bot] sendPhoto upload network", e instanceof Error ? e.message : e);
    }
  }
  return { ok: false, error: "photo_failed" };
}

async function publishPost({
  photoUrl,
  caption,
  buttonUrl,
  imagePrompt,
  preferGenerated = false,
  brandPlacement,
}) {
  const willGenerate = Boolean(imagePrompt) || preferGenerated;
  const placement = brandPlacement || nextBrandPlacement();
  // Всегда генерим бренд-сцену, если просили картинку; URL сайта — только fallback
  const prompt = willGenerate
    ? buildImagePrompt(imagePrompt || "sports coaching in Sochi", placement)
    : undefined;
  if (prompt) {
    console.log(`[channel-bot] image brand mode=${placement}`);
  }
  const reply_markup = ctaKeyboard(buttonUrl);
  const withPhoto = await tgSendPhotoUpload(caption, reply_markup, {
    photoUrl: preferGenerated ? undefined : (photoUrl || "").trim(),
    imagePrompt: prompt,
  });
  if (!withPhoto.ok && preferGenerated && photoUrl) {
    const again = await tgSendPhotoUpload(caption, reply_markup, {
      photoUrl,
    });
    if (again.ok) return again;
  }
  if (withPhoto.ok) return withPhoto;
  return tgApi("sendMessage", {
    chat_id: CHANNEL_ID,
    text: caption,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    reply_markup,
  });
}

async function composeApproved(p) {
  const campaign = `instructor_approved_${p.id || "x"}`;
  const href = siteLink(p.profile_url || "/", campaign);
  const emoji = sportEmoji(p.sport);
  const ai = await enrichWithProvod("новый_инструктор", {
    name: p.name,
    sport: p.sport,
    city: p.city,
  });
  const title =
    ai?.title ||
    `${p.sport ? String(p.sport).replace(/^[\p{Emoji}\s]+/u, "") : "Инструктор"} — ${p.name || "новый тренер"}${p.city ? `, ${p.city}` : ""}`;
  const body =
    ai?.body ||
    `На ТвойТренер.рф появился проверенный инструктор${p.sport ? ` по направлению «${String(p.sport).replace(/^[\p{Emoji}\s]+/u, "").trim()}»` : ""}. Можно сравнить отзывы и записаться онлайн.`;
  const tip = ai?.tip || "Смотрите статус «на линии» — так быстрее получить ответ на заявку.";
  const caption = buildCaption({
    leadEmoji: ai?.lead_emoji || emoji,
    title,
    body,
    tip,
    siteHref: href,
    ctaLead: `Хотите начать тренировки? Найдите своего тренера на <a href="${esc(href)}">ТвойТренер.рф</a>!`,
  });
  return publishPost({
    photoUrl: p.photo_url,
    caption,
    buttonUrl: href,
    imagePrompt: p.photo_url
      ? null
      : ai?.image_prompt ||
        `Photorealistic sports coaching scene, ${p.sport || "training"}, Sochi Russia outdoors, natural light`,
    preferGenerated: !p.photo_url,
  });
}

async function composeOnline(p) {
  const campaign = `instructor_online_${p.id || "x"}`;
  const href = siteLink(p.profile_url || "/", campaign);
  const emoji = sportEmoji(p.sport);
  const ai = await enrichWithProvod("инструктор_на_линии", {
    name: p.name,
    sport: p.sport,
    city: p.city,
    urgent: p.is_urgent,
  });
  const title =
    ai?.title ||
    `${p.name || "Инструктор"} сейчас на линии${p.sport ? ` · ${p.sport}` : ""}`;
  const body =
    ai?.body ||
    `Можно записаться прямо сейчас${p.city ? ` (${p.city})` : ""}. На линии — быстрее ответ на заявку.`;
  const tip = ai?.tip || "Не откладывайте: слоты у востребованных инструкторов разбирают быстро.";
  const caption = buildCaption({
    leadEmoji: ai?.lead_emoji || "🟢",
    title,
    body,
    tip,
    tipLabel: "Совет",
    siteHref: href,
    ctaLead: `Готовы к занятию? Откройте профиль на <a href="${esc(href)}">ТвойТренер.рф</a>!`,
  });
  return publishPost({
    photoUrl: p.photo_url,
    caption,
    buttonUrl: href,
    imagePrompt: p.photo_url
      ? null
      : ai?.image_prompt ||
        `Photorealistic athlete ready for training, ${p.sport || "sport"}, energetic, Sochi`,
    preferGenerated: !p.photo_url,
  });
}

async function composeEvent(p) {
  const campaign = `event_${p.id || "x"}`;
  const href = siteLink(p.signup_url || "/events", campaign);
  const emoji = sportEmoji(p.sport);
  const when = [p.date, p.place].filter(Boolean).join(" · ");
  const ai = await enrichWithProvod("мероприятие", {
    title: p.title,
    date: p.date,
    place: p.place,
    sport: p.sport,
  });
  const title =
    ai?.title ||
    `${p.title || "Мероприятие"}${when ? ` — ${when}` : ""}`;
  const body =
    ai?.body ||
    `Новое событие на ТвойТренер.рф${p.sport ? ` (${p.sport})` : ""}. Запись и детали — на сайте.`;
  const tip = ai?.tip || "Приходите заранее, чтобы спокойно сориентироваться на площадке.";
  const caption = buildCaption({
    leadEmoji: ai?.lead_emoji || emoji,
    title,
    body: `${body} ${emoji}`,
    tip,
    siteHref: href,
  });
  return publishPost({
    photoUrl: p.image_url,
    caption,
    buttonUrl: href,
    imagePrompt:
      ai?.image_prompt ||
      `Photorealistic sports event atmosphere, ${p.sport || "sport"}, ${p.place || "Sochi Sirius"}, crowd energy`,
    preferGenerated: !p.image_url,
  });
}

/** Ручная/тестовая новость в стиле афиши (как раньше). */
async function composeNews(p) {
  const campaign = `news_${Date.now()}`;
  const href = siteLink(p.url || "/", campaign);
  const facts = {
    topic: p.topic || p.title || "спорт в Сочи",
    place: p.place || "Сочи / Сириус / Красная Поляна",
    sport: p.sport || "",
  };
  const ai = await enrichWithProvod("новость_афиша", facts);
  const emoji = ai?.lead_emoji || sportEmoji(p.sport) || "🏃";
  const title =
    ai?.title ||
    p.title ||
    `${facts.topic} — ${facts.place}`;
  const body =
    ai?.body ||
    p.body ||
    "Следите за спортивной повесткой региона и готовьтесь с проверенными инструкторами.";
  const tip = ai?.tip || p.tip || "Заранее выберите тренера под свой вид спорта на карте сайта.";
  const caption = buildCaption({
    leadEmoji: emoji,
    title,
    body: `${body} ${sportEmoji(p.sport)}`,
    tip,
    siteHref: href,
  });
  return publishPost({
    photoUrl: p.image_url,
    caption,
    buttonUrl: href,
    imagePrompt:
      ai?.image_prompt ||
      p.image_prompt ||
      `Photorealistic sports scene for Telegram channel, ${facts.sport || facts.topic}, ${facts.place}, cinematic light`,
    preferGenerated: true,
  });
}

async function handleHook(name, payload) {
  console.log(`[channel-bot] hook ${name}`, JSON.stringify(payload).slice(0, 400));
  if (name === "instructor-approved") return composeApproved(payload);
  if (name === "instructor-online") return composeOnline(payload);
  if (name === "event-published") return composeEvent(payload);
  if (name === "news") return composeNews(payload);
  return { ok: false, error: "unknown hook" };
}

const HOOKS = new Set([
  "instructor-approved",
  "instructor-online",
  "event-published",
  "news",
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        service: "channel-bot",
        channel: CHANNEL_ID,
        has_token: Boolean(BOT_TOKEN),
        has_secret: Boolean(BOT_API_SECRET),
        has_provod: Boolean(PROVOD_API_KEY),
        image_model: IMAGE_MODEL,
        style: "photo+html+cta+provod-image",
      });
    }

    const hookMatch = url.pathname.match(/^\/hooks\/([a-z0-9-]+)$/);
    if (req.method === "POST" && hookMatch) {
      if (!authorize(req)) return unauthorized(res);
      const name = hookMatch[1];
      if (!HOOKS.has(name)) {
        return json(res, 404, { error: `Unknown hook: ${name}` });
      }
      let payload;
      try {
        payload = await readBody(req);
      } catch {
        return json(res, 400, { error: "Invalid JSON" });
      }
      const tg = await handleHook(name, payload);
      return json(res, 200, { ok: true, hook: name, telegram: tg });
    }

    json(res, 404, { error: "Not found" });
  } catch (e) {
    console.error("[channel-bot]", e);
    json(res, 500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[channel-bot] :${PORT} → ${CHANNEL_ID} secret=${BOT_API_SECRET ? "yes" : "NO"} provod=${PROVOD_API_KEY ? "yes" : "no"}`,
  );
});
