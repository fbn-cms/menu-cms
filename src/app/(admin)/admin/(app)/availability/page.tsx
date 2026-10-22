import type { Metadata } from "next";
import { getStaffContext } from "@/lib/auth";
import { withEffectiveAvailability } from "@/lib/availability/effective";
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
        "id, name, category_id, sort_order, availability, availability_note, remaining_qty, availability_until, is_featured, updated_at",
      )
      .eq("is_published", true)
      .order("sort_order")
      .order("name"),
  ]);
  const grouped: BoardCategory[] = (categories ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      // Same view as diners: an expired "until" shows as available right away.
      items: (items ?? [])
        .filter((i) => i.category_id === c.id)
        .map((i) => withEffectiveAvailability(i)),
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
