import { Ban, CircleCheck, Hourglass } from "lucide-react";
import type { Messages } from "@/i18n/t";
import { t } from "@/i18n/t";
import type { MenuItem } from "@/lib/menu/types";
import { cn } from "@/lib/utils";

type Props = {
  availability: MenuItem["availability"];
  remainingQty: number | null;
  messages: Messages;
  formatCount: (n: number) => string;
  className?: string;
};

/** Availability is always text + icon, never colour alone (WCAG 1.4.1). */
export function AvailabilityBadge({
  availability,
  remainingQty,
  messages,
  formatCount,
  className,
}: Props) {
  if (availability === "available") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400",
          className,
        )}
      >
        <CircleCheck aria-hidden="true" className="size-3.5" />
        {messages.available}
      </span>
    );
  }
  if (availability === "limited") {
    return (
      <span
        className={cn(
          // Phrases never break internally; the count wraps as a whole on narrow screens.
          "inline-flex flex-wrap items-center gap-x-1 rounded-2xl bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200",
          className,
        )}
      >
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Hourglass aria-hidden="true" className="size-3.5" />
          {messages.limited}
        </span>
        {remainingQty != null && remainingQty > 0 && (
          <span className="whitespace-nowrap">
            · {t(messages.remaining, { count: formatCount(remainingQty) })}
          </span>
        )}
      </span>
    );
  }
  return (
    <span
      className={cn(
        // foreground/80 on muted ≈ 10.6:1 (muted-foreground was 4.34:1, below WCAG AA 4.5:1)
        "bg-muted text-foreground/80 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Ban aria-hidden="true" className="size-3.5" />
      {messages.unavailable}
    </span>
  );
}
