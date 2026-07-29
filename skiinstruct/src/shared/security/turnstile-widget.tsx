"use client";

import Script from "next/script";

type Props = {
  className?: string;
};

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

export function TurnstileWidget({ className }: Props) {
  if (!SITE_KEY) return null;
  return (
    <div className={className}>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={SITE_KEY} data-response-field-name="captchaToken" />
    </div>
  );
}
