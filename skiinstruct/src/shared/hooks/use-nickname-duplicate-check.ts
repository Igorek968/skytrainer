"use client";

import { useEffect, useState } from "react";

import {
  NICKNAME_SLUG_INVALID_MESSAGE,
  NICKNAME_TAKEN_MESSAGE,
} from "@/lib/instructor-profile-slug";

export function useNicknameDuplicateCheck(
  nickname: string,
  enabled = true,
): {
  duplicate: boolean;
  invalid: boolean;
  checking: boolean;
  blocked: boolean;
  slug: string | null;
  message: string | null;
} {
  const [duplicate, setDuplicate] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [checking, setChecking] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDuplicate(false);
      setInvalid(false);
      setChecking(false);
      setSlug(null);
      return;
    }

    const value = nickname.trim();
    if (value.length < 2) {
      setDuplicate(false);
      setInvalid(false);
      setChecking(false);
      setSlug(null);
      return;
    }

    setChecking(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const qs = new URLSearchParams({ nickname: value });
          const r = await fetch(`/api/nickname/check?${qs}`, { credentials: "include" });
          const j = (await r.json()) as {
            duplicate?: boolean;
            invalid?: boolean;
            slug?: string | null;
          };
          if (!r.ok) {
            setDuplicate(false);
            setInvalid(false);
            return;
          }
          setDuplicate(Boolean(j.duplicate));
          setInvalid(Boolean(j.invalid));
          setSlug(j.slug ?? null);
        } catch {
          setDuplicate(false);
          setInvalid(false);
        } finally {
          setChecking(false);
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [nickname, enabled]);

  const blocked = duplicate || invalid;
  return {
    duplicate,
    invalid,
    checking,
    blocked,
    slug,
    message: invalid
      ? NICKNAME_SLUG_INVALID_MESSAGE
      : duplicate
        ? NICKNAME_TAKEN_MESSAGE
        : null,
  };
}
