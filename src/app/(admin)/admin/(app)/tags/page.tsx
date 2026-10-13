import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { TagManager, type TagRow } from "./tag-manager";

export const metadata: Metadata = { title: "Labels" };

export default async function TagsPage() {
  await requireRole("owner", "admin");
  const supabase = await createSupabaseServer();
  const [{ data: tags }, { data: tr }, { data: uses }] = await Promise.all([
    supabase
      .from("tags")
      .select("id, label, kind, icon, sort_order")
      .order("sort_order")
      .order("label"),
    supabase.from("tag_translations").select("tag_id, locale, label"),
    supabase.from("item_tags").select("tag_id"),
  ]);
  const count = new Map<string, number>();
  for (const u of uses ?? [])
    count.set(u.tag_id, (count.get(u.tag_id) ?? 0) + 1);
  const rows: TagRow[] = (tags ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    kind: t.kind,
    icon: t.icon,
    uses: count.get(t.id) ?? 0,
    translations: {
      fa: tr?.find((x) => x.tag_id === t.id && x.locale === "fa")?.label ?? "",
      fr: tr?.find((x) => x.tag_id === t.id && x.locale === "fr")?.label ?? "",
    },
  }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Labels</h1>
        <p className="text-muted-foreground text-sm">
          Dietary labels and allergens guests can filter by, plus highlight
          labels like “Chef’s pick”.
        </p>
      </div>
      <TagManager rows={rows} />
    </div>
  );
}
