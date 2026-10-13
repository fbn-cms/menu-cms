"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";

const TAPS = 5;
const WINDOW_MS = 2500;
const STORAGE_KEY = "menu.staffLink";

/**
 * Header layout: language menu (and, once revealed, the staff login link) on the top row;
 * logo + name on the row below. Tapping the logo/name 5× quickly reveals "Staff login" —
 * deliberately hidden from diners. Staff can always go to /admin directly as well.
 */
export function HeaderShell({
  brand,
  switcher,
  staffLabel,
}: {
  brand: React.ReactNode;
  switcher: React.ReactNode;
  staffLabel: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const taps = useRef<number[]>([]);

  // Stay revealed for the rest of this browser session (sessionStorage, not a cookie).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") setRevealed(true); // eslint-disable-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
    } catch {
      // storage unavailable
    }
  }, []);

  const onBrandTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < WINDOW_MS), now];
    if (taps.current.length >= TAPS) {
      taps.current = [];
      setRevealed(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // storage unavailable
      }
    }
  };

  return (
    <>
      <div className="flex min-h-11 flex-wrap items-center justify-end gap-1">
        {revealed && (
          <Link
            href="/admin/login"
            prefetch={false}
            className="text-muted-foreground hover:bg-muted inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm"
          >
            <KeyRound aria-hidden="true" className="size-4" />
            {staffLabel}
          </Link>
        )}
        {switcher}
      </div>
      {/* Not a link and not focusable: the brand is just the brand; the tap counter is a hidden feature. */}
      <div
        onClick={onBrandTap}
        className="mt-1 flex min-h-11 min-w-0 cursor-default items-center gap-3 select-none"
        data-testid="brand"
      >
        {brand}
      </div>
    </>
  );
}
