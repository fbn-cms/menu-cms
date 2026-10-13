"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Search,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { TranslationStatus } from "@/components/admin/language-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reorderItems, setItemsPublished } from "@/lib/actions/cms";
import { formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/menu/image";
import { cn } from "@/lib/utils";

export type ItemRow = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  price_cents: number;
  currency: string;
  icon_key: string | null;
  icon_lqip: string | null;
  is_published: boolean;
  availability: "available" | "limited" | "unavailable";
  sort_order: number;
  has: { fa: boolean; fr: boolean };
};

type Status = "all" | "published" | "hidden";

export function ItemList({
  rows: initial,
  categories,
  currency,
}: {
  rows: ItemRow[];
  categories: { id: string; name: string }[];
  currency: string;
}) {
  const [rows, setRows] = useState(initial);
  const [base, setBase] = useState(initial);
  if (base !== initial) {
    setBase(initial);
    setRows(initial);
  }
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [missingOnly, setMissingOnly] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pending, start] = useTransition();
  const catName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const visible = rows.filter(
    (r) =>
      (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())) &&
      (cat === "all" || r.category_id === cat) &&
      (status === "all" || (status === "published") === r.is_published) &&
      (!missingOnly || !r.has.fa || !r.has.fr),
  );
  // Reordering only makes sense within one category and with no other filter applied.
  const canReorder =
    cat !== "all" && !q.trim() && status === "all" && !missingOnly;
  const allVisibleSelected =
    visible.length > 0 && visible.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulk = (published: boolean) => {
    const ids = [...selected];
    start(async () => {
      const res = await setItemsPublished(ids, published);
      if (!res.ok) return void toast.error(res.error);
      setRows((rs) =>
        rs.map((r) =>
          selected.has(r.id) ? { ...r, is_published: published } : r,
        ),
      );
      setSelected(new Set());
      toast.success(
        `${ids.length} ${ids.length === 1 ? "dish" : "dishes"} ${published ? "shown on" : "hidden from"} the menu.`,
      );
    });
  };

  const move = (id: string, delta: -1 | 1) => {
    const inCat = rows.filter((r) => r.category_id === cat);
    const i = inCat.findIndex((r) => r.id === id);
    const next = [...inCat];
    const [m] = next.splice(i, 1);
    next.splice(i + delta, 0, m!);
    const order = new Map(next.map((r, k) => [r.id, k + 1]));
    const before = rows;
    setRows((rs) =>
      [...rs]
        .map((r) =>
          order.has(r.id) ? { ...r, sort_order: order.get(r.id)! } : r,
        )
        .sort((a, b) => a.sort_order - b.sort_order),
    );
    start(async () => {
      const res = await reorderItems(next.map((r) => r.id));
      if (!res.ok) {
        setRows(before);
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Label htmlFor="item-search" className="sr-only">
            Search dishes
          </Label>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            id="item-search"
            type="search"
            placeholder="Search dishes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 ps-9 text-base"
          />
        </div>
        <select
          aria-label="Category"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="bg-background h-11 rounded-md border px-3 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="bg-background h-11 rounded-md border px-3 text-sm"
        >
          <option value="all">Shown and hidden</option>
          <option value="published">Shown on menu</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
            className="accent-foreground size-4"
          />
          Missing translations only
        </label>
        {!canReorder && (
          <p className="text-muted-foreground text-xs">
            Pick one category to reorder its dishes.
          </p>
        )}
      </div>

      {/* Bulk actions */}
      <div className="bg-background/95 sticky top-[7.25rem] z-10 flex flex-wrap items-center gap-2 rounded-xl border p-2 backdrop-blur">
        <label className="flex min-h-10 items-center gap-2 px-1 text-sm">
          <input
            type="checkbox"
            aria-label="Select all shown"
            checked={allVisibleSelected}
            onChange={() =>
              setSelected(
                allVisibleSelected
                  ? new Set()
                  : new Set(visible.map((r) => r.id)),
              )
            }
            className="accent-foreground size-4"
          />
          {selected.size
            ? `${selected.size} selected`
            : `${visible.length} ${visible.length === 1 ? "dish" : "dishes"}`}
        </label>
        <div className="ms-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!selected.size || pending}
            onClick={() => bulk(true)}
          >
            <Eye aria-hidden="true" className="size-4" />
            Show
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!selected.size || pending}
            onClick={() => bulk(false)}
          >
            <EyeOff aria-hidden="true" className="size-4" />
            Hide
          </Button>
        </div>
      </div>

      <ul className="divide-y rounded-2xl border">
        {visible.map((r, i) => (
          <li
            key={r.id}
            className={cn(
              "flex items-center gap-2 p-2.5",
              !r.is_published && "bg-muted/40",
            )}
          >
            <input
              type="checkbox"
              aria-label={`Select ${r.name}`}
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              className="accent-foreground size-5 shrink-0"
            />
            {canReorder && (
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Move ${r.name} up`}
                  disabled={i === 0 || pending}
                  onClick={() => move(r.id, -1)}
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Move ${r.name} down`}
                  disabled={i === visible.length - 1 || pending}
                  onClick={() => move(r.id, 1)}
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </Button>
              </div>
            )}
            <Link
              href={`/admin/items/${r.id}`}
              className="hover:bg-muted/60 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg"
            >
              <span
                className="bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                style={
                  r.icon_lqip
                    ? {
                        backgroundImage: `url(${r.icon_lqip})`,
                        backgroundSize: "cover",
                      }
                    : undefined
                }
              >
                {r.icon_key ? (
                  // eslint-disable-next-line @next/next/no-img-element -- no next/image on Workers
                  <img
                    src={imageUrl(r.icon_key)}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <Utensils
                    aria-hidden="true"
                    className="text-muted-foreground size-5"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                  <span>{catName.get(r.category_id)}</span>
                  <span className="tabular-nums">
                    {formatPrice(r.price_cents, r.currency || currency, "en")}
                  </span>
                  <TranslationStatus has={r.has} />
                </span>
              </span>
              {!r.is_published && <Badge variant="outline">Hidden</Badge>}
            </Link>
          </li>
        ))}
        {!visible.length && (
          <li className="text-muted-foreground p-4 text-center text-sm">
            No dishes match.
          </li>
        )}
      </ul>
    </div>
  );
}
