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
 *
 * Ornate (pattern themes): the top row floats on a patterned masthead band and the brand sits
 * centred on a framed plaque that overlaps the band's lower edge, like a tile cartouche.
 */
export function HeaderShell({
  brand,
  switcher,
  staffLabel,
  ornate = false,
}: {
  brand: React.ReactNode;
  switcher: React.ReactNode;
  staffLabel: string;
  ornate?: boolean;
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

  const topRow = (
    <>
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
    </>
  );

  if (ornate) {
    return (
      <>
        <div className="pattern-band border-primary relative h-32 border-b-[3px]">
          <div className="bg-background/90 absolute end-2 top-2 flex flex-wrap items-center justify-end gap-1 rounded-xl px-1 shadow-md backdrop-blur-sm">
            {topRow}
          </div>
        </div>
        <div className="relative -mt-11 flex justify-center px-6">
          {/* Not a link and not focusable: the tap counter is a hidden feature. */}
          <div
            onClick={onBrandTap}
            data-testid="brand"
            className="bg-background outline-primary/70 ring-primary/70 flex min-h-[5.5rem] max-w-full min-w-0 cursor-default flex-col items-center justify-center gap-2 rounded-2xl px-8 py-4 text-center shadow-xl ring-1 outline-1 -outline-offset-[7px] outline-solid select-none"
          >
            {brand}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex min-h-11 flex-wrap items-center justify-end gap-1">
        {topRow}
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
