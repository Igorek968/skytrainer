export const API_BASE = String(import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);

export const TOKEN_KEY = "skytrainer_token";
