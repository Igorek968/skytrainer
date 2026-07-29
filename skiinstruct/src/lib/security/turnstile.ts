type TurnstileResponse = {
  success?: boolean;
};

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function secretKey(): string {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || "";
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = secretKey();
  if (!secret) return true;
  const trimmed = token?.trim() || "";
  if (!trimmed) return false;

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", trimmed);
    if (remoteIp?.trim()) form.set("remoteip", remoteIp.trim());

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = (await res.json().catch(() => null)) as TurnstileResponse | null;
    return Boolean(json?.success);
  } catch {
    return false;
  }
}
