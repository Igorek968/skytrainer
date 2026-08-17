"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import { YM_GOALS, trackYandexGoal } from "@/shared/analytics/yandex-metrika-client";
import { Button } from "@/shared/ui/button";
import { sanitizeRedirectPath } from "@/lib/sanitize-auth-redirect";

export function SocialSignInButtons({ callbackUrl }: { callbackUrl: string }) {
  const [google, setGoogle] = useState(false);
  const safeCallback = sanitizeRedirectPath(callbackUrl, "/client");

  useEffect(() => {
    fetch("/api/auth/social-providers")
      .then((r) => r.json())
      .then((j: { google?: boolean }) => setGoogle(Boolean(j.google)))
      .catch(() => setGoogle(false));
  }, []);

  if (!google) return null;

  return (
    <div className="space-y-2">
      <div className="relative py-1 text-center text-xs text-muted-foreground">
        <span className="bg-card px-2">или</span>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          trackYandexGoal(YM_GOALS.googleAuthStart);
          void signIn("google", { callbackUrl: safeCallback });
        }}
      >
        Войти через Google
      </Button>
    </div>
  );
}
