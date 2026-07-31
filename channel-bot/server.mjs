/**
 * Приёмник outbound-webhook’ов сайта → посты в Telegram-канал.
 * Контракт: skiinstruct/BOT_API.md
 */
import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const BOT_API_SECRET = (process.env.BOT_API_SECRET || "").trim();
const BOT_TOKEN = (process.env.BOT_TOKEN || "").trim();
const CHANNEL_ID = (process.env.CHANNEL_ID || "@tvoitrenerrf").trim();

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
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${BOT_API_SECRET}`;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

async function tgSendMessage(text, replyMarkup) {
  if (!BOT_TOKEN) {
    console.warn("[channel-bot] BOT_TOKEN empty — skip Telegram send");
    return { ok: false, skipped: true };
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: CHANNEL_ID,
    text,
    disable_web_page_preview: false,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.error("[channel-bot] Telegram sendMessage failed", res.status, data);
    }
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[channel-bot] Telegram network error", msg);
    return { ok: false, error: msg };
  }
}

function buttonUrl(text, url) {
  if (!url) return undefined;
  return { inline_keyboard: [[{ text, url }]] };
}

function formatApproved(p) {
  const lines = [
    "Новый инструктор на ТвойТренер.рф",
    "",
    `${p.name || "Инструктор"}${p.sport ? ` · ${p.sport}` : ""}`,
  ];
  if (p.city) lines.push(p.city);
  return lines.join("\n");
}

function formatOnline(p) {
  const lines = [
    "На линии сейчас",
    "",
    `${p.name || "Инструктор"}${p.sport ? ` · ${p.sport}` : ""}`,
  ];
  if (p.city) lines.push(p.city);
  if (p.is_urgent) lines.push("Можно записаться срочно");
  return lines.join("\n");
}

function formatEvent(p) {
  const lines = ["Мероприятие на ТвойТренер.рф", "", p.title || "Событие"];
  if (p.date) lines.push(`Дата: ${p.date}`);
  if (p.place) lines.push(p.place);
  if (p.sport) lines.push(p.sport);
  return lines.join("\n");
}

async function handleHook(name, payload) {
  console.log(`[channel-bot] hook ${name}`, JSON.stringify(payload).slice(0, 400));
  if (name === "instructor-approved") {
    return tgSendMessage(formatApproved(payload), buttonUrl("Открыть профиль", payload.profile_url));
  }
  if (name === "instructor-online") {
    return tgSendMessage(formatOnline(payload), buttonUrl("К инструктору", payload.profile_url));
  }
  if (name === "event-published") {
    return tgSendMessage(
      formatEvent(payload),
      buttonUrl("Записаться", payload.signup_url || "https://твойтренер.рф/events"),
    );
  }
  return { ok: false, error: "unknown hook" };
}

const HOOKS = new Set([
  "instructor-approved",
  "instructor-online",
  "event-published",
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
    `[channel-bot] listening :${PORT} → channel ${CHANNEL_ID} (secret=${BOT_API_SECRET ? "yes" : "NO"})`,
  );
});
