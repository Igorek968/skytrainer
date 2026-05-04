import { API_BASE, TOKEN_KEY } from "../config.js";

export { API_BASE };

export async function apiJson(path, opts = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      body?.error != null
        ? typeof body.error === "string"
          ? body.error
          : JSON.stringify(body.error)
        : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return body;
}
