"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { parseAvailabilityPatch } from "@/lib/menu/patch";
import type { AvailabilityPatch } from "@/lib/menu/types";

type Status = "connecting" | "live" | "offline";

/**
 * Subscribes to the private broadcast channel `menu:<restaurantId>` and reports availability
 * patches. supabase-js is loaded lazily after the page is idle so it never delays first paint.
 * If the socket fails, falls back to re-fetching the (cached) page when the tab regains focus.
 */
export function useLiveAvailability(
  restaurantId: string,
  onPatch: (patch: AvailabilityPatch) => void,
): Status {
  const [status, setStatus] = useState<Status>("connecting");
  const statusRef = useRef<Status>("connecting");
  const onPatchRef = useRef(onPatch);
  const router = useRouter();

  useEffect(() => {
    onPatchRef.current = onPatch;
  }, [onPatch]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const set = (s: Status) => {
      statusRef.current = s;
      if (!cancelled) setStatus(s);
    };

    const start = async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        if (cancelled) return;
        const supabase = createClient(
          publicEnv.NEXT_PUBLIC_SUPABASE_URL,
          publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const channel = supabase
          .channel(`menu:${restaurantId}`, { config: { private: true } })
          .on("broadcast", { event: "availability" }, ({ payload }) => {
            const patch = parseAvailabilityPatch(payload);
            if (patch) onPatchRef.current(patch);
          })
          .subscribe((state) => {
            if (state === "SUBSCRIBED") set("live");
            else if (
              state === "CHANNEL_ERROR" ||
              state === "TIMED_OUT" ||
              state === "CLOSED"
            )
              set("offline");
          });
        cleanup = () => void supabase.removeChannel(channel);
      } catch {
        set("offline");
      }
    };

    // Safari lacks requestIdleCallback; a short timeout is close enough.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle
      ? window.requestIdleCallback(() => void start(), { timeout: 3000 })
      : setTimeout(() => void start(), 1500);

    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        statusRef.current === "offline"
      )
        router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(idle as number);
      else clearTimeout(idle);
      document.removeEventListener("visibilitychange", onVisible);
      cleanup?.();
    };
  }, [restaurantId, router]);

  return status;
}
