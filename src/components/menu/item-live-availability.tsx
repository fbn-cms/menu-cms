"use client";

import { useCallback, useState } from "react";
import { Ban, Hourglass } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { t, type Messages } from "@/i18n/t";
import { formatNumber, type PersianDigits } from "@/lib/format";
import type { AvailabilityPatch, ItemDetail } from "@/lib/menu/types";
import { AvailabilityBadge } from "./availability-badge";
import { useLiveAvailability } from "./use-live-availability";

type Props = {
  restaurantId: string;
  item: Pick<
    ItemDetail,
    "id" | "availability" | "availability_note" | "remaining_qty"
  >;
  locale: Locale;
  digits: PersianDigits;
  messages: Messages;
  /** "banner" = prominent top-of-page notice; "badge" = inline badge. */
  variant: "banner" | "badge";
};

export function ItemLiveAvailability({
  restaurantId,
  item,
  locale,
  digits,
  messages,
  variant,
}: Props) {
  const [state, setState] = useState(item);
  const onPatch = useCallback(
    (p: AvailabilityPatch) => {
      if (p.id !== item.id) return;
      setState({
        id: p.id,
        availability: p.availability,
        availability_note:
          p.availability === "available" ? null : p.availability_note,
        remaining_qty: p.availability === "limited" ? p.remaining_qty : null,
      });
    },
    [item.id],
  );
  useLiveAvailability(restaurantId, onPatch);
  const fmt = (n: number) => formatNumber(n, locale, digits);

  if (variant === "badge") {
    return (
      <AvailabilityBadge
        availability={state.availability}
        remainingQty={state.remaining_qty}
        messages={messages}
        formatCount={fmt}
      />
    );
  }
  if (state.availability === "available")
    return <div role="status" aria-live="polite" />;
  const soldOut = state.availability === "unavailable";
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        soldOut
          ? "bg-muted flex items-start gap-3 px-4 py-3 text-sm"
          : "flex items-start gap-3 bg-amber-100 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100"
      }
    >
      {soldOut ? (
        <Ban aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      ) : (
        <Hourglass aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      )}
      <div>
        <p className="font-medium">
          {soldOut ? messages.soldOutBanner : messages.limitedBanner}
          {!soldOut &&
            state.remaining_qty != null &&
            state.remaining_qty > 0 &&
            ` ${t(messages.remaining, { count: fmt(state.remaining_qty) })}`}
        </p>
        {state.availability_note && (
          <p className="mt-0.5">{state.availability_note}</p>
        )}
      </div>
    </div>
  );
}
