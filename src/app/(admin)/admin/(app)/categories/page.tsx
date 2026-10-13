import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CategoryList } from "./category-list";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireRole("owner", "admin");
  const supabase = await createSupabaseServer();
  const [{ data: categories }, { data: items }, { data: translations }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, is_published, sort_order")
        .order("sort_order")
        .order("name"),
      supabase.from("items").select("category_id"),
      supabase
        .from("category_translations")
        .select("category_id, locale, name"),
    ]);
  const counts = new Map<string, number>();
  for (const i of items ?? [])
    counts.set(i.category_id, (counts.get(i.category_id) ?? 0) + 1);
  const rows = (categories ?? []).map((c) => ({
    ...c,
    itemCount: counts.get(c.id) ?? 0,
    has: {
      fa: (translations ?? []).some(
        (t) => t.category_id === c.id && t.locale === "fa" && t.name,
      ),
      fr: (translations ?? []).some(
        (t) => t.category_id === c.id && t.locale === "fr" && t.name,
      ),
    },
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Categories</h1>
          <p className="text-muted-foreground text-sm">
            Sections of the menu, in the order guests see them.
          </p>
        </div>
        <Button asChild className="h-11">
          <Link href="/admin/categories/new">
            <Plus aria-hidden="true" className="size-4" />
            New category
          </Link>
        </Button>
      </div>
      <CategoryList rows={rows} />
    </div>
  );
}
