"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { ChefHat, Flame, Search, WifiOff, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { t, type Messages } from "@/i18n/t";
import { formatNumber, formatPrice, normalizeForSearch } from "@/lib/format";
import { sortMenuItems } from "@/lib/menu/ordering";
import type {
  AvailabilityPatch,
  Menu,
  MenuCategory,
  MenuItem,
} from "@/lib/menu/types";
import { cn } from "@/lib/utils";
import { AvailabilityBadge } from "./availability-badge";
import { ItemThumb } from "./item-thumb";
import { TagIcon } from "./tag-icon";
import { useLiveAvailability } from "./use-live-availability";

type PriceRange = "all" | "under" | "between" | "over";
const PRICE_LOW = 1000; // cents
const PRICE_HIGH = 2000;
const EMPTY_PATCHES: ReadonlyMap<string, AvailabilityPatch> = new Map();

type Props = {
  menu: Menu;
  locale: Locale;
  messages: Messages;
  /** When set, render only this category (category page). */
  categorySlug?: string;
};

export function MenuView({ menu, locale, messages, categorySlug }: Props) {
  const { restaurant } = menu;
  const digits = restaurant.persian_digits;
  const fmtPrice = useCallback(
    (cents: number) => formatPrice(cents, restaurant.currency, locale, digits),
    [restaurant.currency, locale, digits],
  );
  const fmtCount = useCallback(
    (n: number) => formatNumber(n, locale, digits),
    [locale, digits],
  );

  // ---------------------------------------------------------------- live availability
  // Patches are tied to the menu they were applied to: fresh server data supersedes them.
  const [live, setLive] = useState<{
    base: Menu;
    patches: ReadonlyMap<string, AvailabilityPatch>;
  }>({
    base: menu,
    patches: new Map(),
  });
  const patches = live.base === menu ? live.patches : EMPTY_PATCHES;

  const onPatch = useCallback(
    (patch: AvailabilityPatch) => {
      const apply = () =>
        setLive((prev) => ({
          base: menu,
          patches: new Map(
            prev.base === menu ? prev.patches : EMPTY_PATCHES,
          ).set(patch.id, patch),
        }));
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!reduceMotion && "startViewTransition" in document) {
        // Animates the item sliding to its new position in the category.
        document.startViewTransition(() => flushSync(apply));
      } else {
        apply();
      }
    },
    [menu],
  );
  const liveStatus = useLiveAvailability(restaurant.id, onPatch);

  const categories = useMemo<MenuCategory[]>(() => {
    const source = categorySlug
      ? menu.categories.filter((c) => c.slug === categorySlug)
      : menu.categories;
    return source.map((c) => ({
      ...c,
      items: sortMenuItems(
        c.items.map((item): MenuItem => {
          const p = patches.get(item.id);
          if (!p) return item;
          return {
            ...item,
            availability: p.availability,
            // Live notes arrive in the base language; fallback to English is allowed (spec §4).
            availability_note:
              p.availability === "available" ? null : p.availability_note,
            remaining_qty:
              p.availability === "limited" ? p.remaining_qty : null,
            is_featured: p.is_featured ?? item.is_featured,
          };
        }),
      ),
    }));
  }, [menu.categories, categorySlug, patches]);

  // ---------------------------------------------------------------- search & filters
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<ReadonlySet<string>>(new Set());
  const [availableOnly, setAvailableOnly] = useState(false);
  const [price, setPrice] = useState<PriceRange>("all");
  const dietaryTags = menu.tags.filter((tag) => tag.kind === "dietary");
  const tagsById = useMemo(
    () => new Map(menu.tags.map((tag) => [tag.id, tag])),
    [menu.tags],
  );
  const filtersActive =
    query.trim() !== "" ||
    tagFilter.size > 0 ||
    availableOnly ||
    price !== "all";

  const visible = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    const match = (item: MenuItem) =>
      (!q ||
        normalizeForSearch(
          `${item.name} ${item.short_description ?? ""}`,
        ).includes(q)) &&
      [...tagFilter].every((id) => item.tag_ids.includes(id)) &&
      (!availableOnly || item.availability !== "unavailable") &&
      (price === "all" ||
        (price === "under" && item.price_cents < PRICE_LOW) ||
        (price === "between" &&
          item.price_cents >= PRICE_LOW &&
          item.price_cents <= PRICE_HIGH) ||
        (price === "over" && item.price_cents > PRICE_HIGH));
    return categories
      .map((c) => ({ ...c, items: c.items.filter(match) }))
      .filter((c) => c.items.length > 0 || !filtersActive);
  }, [categories, query, tagFilter, availableOnly, price, filtersActive]);
  const resultCount = visible.reduce((n, c) => n + c.items.length, 0);

  const clearFilters = () => {
    setQuery("");
    setTagFilter(new Set());
    setAvailableOnly(false);
    setPrice("all");
  };
  const toggleTag = (id: string) =>
    setTagFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ---------------------------------------------------------------- scroll-spy
  const [activeSlug, setActiveSlug] = useState(visible[0]?.slug);
  const navRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (categorySlug) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (top) setActiveSlug(top.target.id.replace(/^c-/, ""));
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    document
      .querySelectorAll("section[data-category]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visible, categorySlug]);
  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>(`[data-chip="${activeSlug}"]`)
      ?.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "smooth",
      });
  }, [activeSlug]);

  const searchId = useId();
  const priceId = useId();

  return (
    <div data-live={liveStatus}>
      {/* Sticky category chips. Scrolls horizontally; under RTL the browser mirrors direction. */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
        <nav
          aria-label={messages.categories}
          ref={navRef}
          className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2"
        >
          {categorySlug && (
            <Link href={`/${locale}/menu`} className="chip">
              {messages.fullMenu}
            </Link>
          )}
          {menu.categories.map((c) => {
            const active = categorySlug
              ? c.slug === categorySlug
              : c.slug === activeSlug;
            return (
              <Link
                key={c.id}
                data-chip={c.slug}
                href={
                  categorySlug ? `/${locale}/menu/${c.slug}` : `#c-${c.slug}`
                }
                aria-current={
                  active ? (categorySlug ? "page" : "location") : undefined
                }
                className={cn("bidi-text chip", active && "chip-active")}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Search + filters */}
      <div className="space-y-3 px-4 pt-4">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {messages.search}
          </label>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={messages.searchPlaceholder}
            className="bg-background focus-visible:ring-ring h-11 w-full rounded-xl border ps-9 pe-3 text-base outline-none focus-visible:ring-2"
          />
        </div>
        <div
          role="group"
          aria-label={messages.filters}
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
        >
          <button
            type="button"
            aria-pressed={availableOnly}
            onClick={() => setAvailableOnly((v) => !v)}
            className={cn("chip", availableOnly && "chip-active")}
          >
            {messages.availableNow}
          </button>
          {dietaryTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              aria-pressed={tagFilter.has(tag.id)}
              onClick={() => toggleTag(tag.id)}
              className={cn("chip", tagFilter.has(tag.id) && "chip-active")}
            >
              <TagIcon name={tag.icon} className="size-4" />
              {tag.label}
            </button>
          ))}
          <label htmlFor={priceId} className="sr-only">
            {messages.price}
          </label>
          <select
            id={priceId}
            value={price}
            onChange={(e) => setPrice(e.target.value as PriceRange)}
            className={cn(
              "chip appearance-none pe-3",
              price !== "all" && "chip-active",
            )}
          >
            <option value="all">{messages.priceAll}</option>
            <option value="under">
              {t(messages.priceUnder, { amount: fmtPrice(PRICE_LOW) })}
            </option>
            <option value="between">
              {t(messages.priceBetween, {
                from: fmtPrice(PRICE_LOW),
                to: fmtPrice(PRICE_HIGH),
              })}
            </option>
            <option value="over">
              {t(messages.priceOver, { amount: fmtPrice(PRICE_HIGH) })}
            </option>
          </select>
        </div>
        {/* Live region stays mounted so screen readers announce result counts. */}
        <div
          className={cn(
            "text-muted-foreground flex items-center justify-between text-sm",
            !filtersActive && "sr-only",
          )}
        >
          <p aria-live="polite">
            {filtersActive
              ? t(messages.resultsCount, { count: fmtCount(resultCount) })
              : ""}
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4"
            >
              <X aria-hidden="true" className="size-4" />
              {messages.clearFilters}
            </button>
          )}
        </div>
        {liveStatus === "offline" && (
          <p
            role="status"
            className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          >
            <WifiOff aria-hidden="true" className="size-4 shrink-0" />
            {messages.liveOffline}
          </p>
        )}
      </div>

      {/* Menu */}
      <div id="menu" className="pb-4">
        {visible.length === 0 && (
          <p className="text-muted-foreground px-4 py-12 text-center">
            {messages.noResults}
          </p>
        )}
        {visible.map((category) => (
          <section
            key={category.id}
            id={`c-${category.slug}`}
            data-category
            aria-labelledby={`h-${category.slug}`}
            // Each category is its own rounded panel; dishes sit on it as raised cards.
            className="bg-muted/40 mx-3 mt-5 scroll-mt-16 rounded-2xl border p-2.5 shadow-sm"
          >
            <h2
              id={`h-${category.slug}`}
              className="bidi-text text-xl font-semibold"
            >
              {categorySlug ? (
                category.name
              ) : (
                <Link href={`/${locale}/menu/${category.slug}`}>
                  {category.name}
                </Link>
              )}
            </h2>
            {category.description && (
              <p className="bidi-text text-muted-foreground mt-1 text-sm">
                {category.description}
              </p>
            )}
            <ul className="mt-3 space-y-3">
              {category.items.map((item) => (
                <li
                  key={item.id}
                  style={{ viewTransitionName: `i-${item.id}` }}
                >
                  <ItemRow
                    item={item}
                    locale={locale}
                    messages={messages}
                    fmtPrice={fmtPrice}
                    fmtCount={fmtCount}
                    tagsById={tagsById}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

const AVAILABILITY_DOT: Record<MenuItem["availability"], string> = {
  available: "bg-emerald-500",
  limited: "bg-amber-400",
  unavailable: "bg-red-600",
};

function ItemRow({
  item,
  locale,
  messages,
  fmtPrice,
  fmtCount,
  tagsById,
}: {
  item: MenuItem;
  locale: Locale;
  messages: Messages;
  fmtPrice: (c: number) => string;
  fmtCount: (n: number) => string;
  tagsById: Map<string, Menu["tags"][number]>;
}) {
  const soldOut = item.availability === "unavailable";
  const dietary = item.tag_ids
    .map((id) => tagsById.get(id))
    .filter((tag) => tag?.kind === "dietary");
  return (
    <Link
      href={`/${locale}/item/${item.slug}`}
      data-availability={item.availability}
      className={cn(
        "bg-background focus-visible:ring-ring relative flex gap-3 rounded-xl border p-3 shadow-md shadow-black/5 transition-shadow outline-none hover:shadow-lg focus-visible:ring-2",
        soldOut && "shadow-sm",
      )}
    >
      <div className="relative shrink-0">
        <ItemThumb
          iconKey={item.icon_key}
          lqip={item.icon_lqip}
          dimmed={soldOut}
          className="size-[72px]"
        />
        {/* Availability dot on the photo's top corner, on the side away from the name (mirrors in
            RTL). Outside the thumb so the sold-out grey filter doesn't dull it. Decorative: the
            text badge carries the meaning. */}
        <span
          aria-hidden="true"
          data-testid="availability-dot"
          className={cn(
            "ring-background absolute -start-1 -top-1 size-3.5 rounded-full ring-2",
            AVAILABILITY_DOT[item.availability],
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "bidi-text leading-snug font-medium",
              soldOut && "text-muted-foreground",
            )}
          >
            {item.name}
          </h3>
          <span
            className={cn(
              "shrink-0 font-medium tabular-nums",
              soldOut && "text-muted-foreground",
            )}
          >
            {fmtPrice(item.price_cents)}
          </span>
        </div>
        {item.short_description && (
          <p className="bidi-text text-muted-foreground mt-0.5 line-clamp-2 text-sm">
            {item.short_description}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <AvailabilityBadge
            availability={item.availability}
            remainingQty={item.remaining_qty}
            messages={messages}
            formatCount={fmtCount}
          />
          {item.availability_note && (
            <span className="text-muted-foreground text-xs">
              {item.availability_note}
            </span>
          )}
          {item.is_featured && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <ChefHat aria-hidden="true" className="size-3.5" />
              {messages.featured}
            </span>
          )}
          {item.spice_level > 0 && (
            <span
              className="inline-flex items-center text-orange-700 dark:text-orange-400"
              title={messages.spiceLevel}
            >
              {Array.from({ length: item.spice_level }, (_, i) => (
                <Flame key={i} aria-hidden="true" className="size-3.5" />
              ))}
              <span className="sr-only">{`${messages.spiceLevel}: ${messages[`spice${item.spice_level}` as "spice1"]}`}</span>
            </span>
          )}
          {dietary.map((tag) => (
            <span
              key={tag!.id}
              className="text-muted-foreground inline-flex items-center gap-0.5 text-xs"
            >
              <TagIcon name={tag!.icon} className="size-3.5" />
              {tag!.label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
