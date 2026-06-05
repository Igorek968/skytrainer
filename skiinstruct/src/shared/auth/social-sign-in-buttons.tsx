"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";

export function SocialSignInButtons({ callbackUrl }: { callbackUrl: string }) {
  const [google, setGoogle] = useState(false);

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
        onClick={() => signIn("google", { callbackUrl })}
      >
        Войти через Google
      </Button>
    </div>
  );
}
