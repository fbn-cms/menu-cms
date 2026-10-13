import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ItemList, type ItemRow } from "./item-list";

export const metadata: Metadata = { title: "Dishes" };

export default async function ItemsPage() {
  await requireRole("owner", "admin");
  const supabase = await createSupabaseServer();
  const [{ data: items }, { data: categories }, { data: tr }, { data: r }] =
    await Promise.all([
      supabase
        .from("items")
        .select(
          "id, name, slug, category_id, price_cents, currency, icon_key, icon_lqip, is_published, availability, sort_order",
        )
        .order("sort_order")
        .order("name"),
      supabase
        .from("categories")
        .select("id, name, sort_order")
        .order("sort_order")
        .order("name"),
      supabase.from("item_translations").select("item_id, locale, name"),
      supabase.from("restaurants").select("currency").limit(1).maybeSingle(),
    ]);
  const rows: ItemRow[] = (items ?? []).map((i) => ({
    ...i,
    has: {
      fa: !!tr?.some((t) => t.item_id === i.id && t.locale === "fa" && t.name),
      fr: !!tr?.some((t) => t.item_id === i.id && t.locale === "fr" && t.name),
    },
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Dishes</h1>
          <p className="text-muted-foreground text-sm">
            Everything on the menu. Tap a dish to edit it.
          </p>
        </div>
        <Button asChild className="h-11">
          <Link href="/admin/items/new">
            <Plus aria-hidden="true" className="size-4" />
            New dish
          </Link>
        </Button>
      </div>
      <ItemList
        rows={rows}
        categories={categories ?? []}
        currency={r?.currency ?? "CAD"}
      />
    </div>
  );
}
