import { Utensils } from "lucide-react";
import { imageUrl } from "@/lib/menu/fetch";
import { cn } from "@/lib/utils";

type Props = {
  iconKey: string | null;
  lqip: string | null;
  dimmed?: boolean;
  className?: string;
};

/** Square 80px icon. Explicit size + LQIP background → zero layout shift. */
export function ItemThumb({ iconKey, lqip, dimmed, className }: Props) {
  return (
    <div
      className={cn(
        "bg-muted relative size-20 shrink-0 overflow-hidden rounded-xl",
        dimmed && "opacity-50 grayscale",
        className,
      )}
      style={
        lqip
          ? { backgroundImage: `url(${lqip})`, backgroundSize: "cover" }
          : undefined
      }
    >
      {iconKey ? (
        // eslint-disable-next-line @next/next/no-img-element -- next/image needs sharp, unavailable on Workers (spec §2)
        <img
          src={imageUrl(iconKey)}
          alt=""
          width={80}
          height={80}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <div className="text-muted-foreground/60 flex size-full items-center justify-center">
          <Utensils aria-hidden="true" className="size-7" />
        </div>
      )}
    </div>
  );
}
