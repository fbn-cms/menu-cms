import { MapPin, Phone } from "lucide-react";
import type { Messages } from "@/i18n/t";
import type { Menu } from "@/lib/menu/types";
import { readTheme } from "@/lib/theme";

/** Address, phone and copyright. Fields left empty in Settings are hidden. */
export function SiteFooter({
  restaurant,
  messages,
}: {
  restaurant: Menu["restaurant"];
  messages: Messages;
}) {
  const holder =
    readTheme(restaurant.theme).copyrightHolder.trim() || restaurant.name;
  const tel = restaurant.phone?.replace(/[^\d+]/g, "");
  const year = new Date().getFullYear();
  return (
    <footer className="surface-chrome ornate:mt-14 ornate:border-t-0 ornate:pt-0 ornate:text-center mt-8 border-t px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm">
      {/* Ornate themes close the menu with a narrow frieze of the pattern. */}
      <div
        aria-hidden="true"
        className="pattern-band border-primary ornate:block -mx-4 mb-6 hidden h-9 border-y-2"
      />
      {(restaurant.address || restaurant.phone) && (
        <address className="space-y-1 not-italic">
          {restaurant.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${messages.address}: ${restaurant.address} (${messages.openInMaps})`}
              className="ornate:justify-center flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
            >
              <MapPin
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
              />
              <span className="bidi-text">{restaurant.address}</span>
            </a>
          )}
          {restaurant.phone && tel && (
            <a
              href={`tel:${tel}`}
              aria-label={`${messages.call}: ${restaurant.phone}`}
              className="ornate:justify-center flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
            >
              <Phone
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
              />
              {/* Phone numbers read left-to-right even inside Persian text. */}
              <bdi dir="ltr">{restaurant.phone}</bdi>
            </a>
          )}
        </address>
      )}
      <p className="text-muted-foreground mt-4 text-xs">
        © <bdi>{year}</bdi> <bdi>{holder}</bdi>. {messages.allRightsReserved}
      </p>
    </footer>
  );
}
