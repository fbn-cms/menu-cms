import type { Metadata } from "next";
import { getStaffContext } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Board, type BoardCategory } from "./board";

export const metadata: Metadata = { title: "86 board" };

export default async function AvailabilityPage() {
  const ctx = await getStaffContext(); // every role may use the 86 board
  const supabase = await createSupabaseServer();
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, sort_order")
      .order("sort_order")
      .order("name"),
    supabase
      .from("items")
      .select(
        "id, name, category_id, sort_order, availability, availability_note, remaining_qty, availability_until, updated_at",
      )
      .eq("is_published", true)
      .order("sort_order")
      .order("name"),
  ]);
  const grouped: BoardCategory[] = (categories ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: (items ?? []).filter((i) => i.category_id === c.id),
    }))
    .filter((c) => c.items.length > 0);

  return (
    <Board
      categories={grouped}
      canReset={ctx.profile.role !== "staff"}
      timezone={ctx.restaurant.timezone}
    />
  );
}
