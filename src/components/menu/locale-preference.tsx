"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  isLocale,
  LOCALE_STORAGE_KEY,
  swapLocale,
  type Locale,
} from "@/i18n/config";

/**
 * Honour a remembered language choice after an automatic redirect (`?l=auto`, set by `/` and
 * the QR landing). Explicit locale URLs are never overridden.
 */
export function LocalePreference({ current }: { current: Locale }) {
  const router = useRouter();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("l") !== "auto") return;
    url.searchParams.delete("l");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      // storage unavailable
    }
    if (stored && isLocale(stored) && stored !== current) {
      router.replace(swapLocale(url.pathname, stored) + url.search + url.hash);
    } else {
      window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
    }
  }, [current, router]);
  return null;
}
