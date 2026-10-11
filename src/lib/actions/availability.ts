"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { computeUntil } from "@/lib/availability/until";
import { getStaffContext } from "@/lib/auth";
import { menuTag } from "@/lib/menu/fetch";
import { createSupabaseServer } from "@/lib/supabase/server";

export type BoardRow = {
  id: string;
  availability: "available" | "limited" | "unavailable";
  availability_note: string | null;
  remaining_qty: number | null;
  availability_until: string | null;
  updated_at: string;
};

export type ActionResult =
  | { ok: true; row: BoardRow }
  | { ok: false; error: string; conflict?: boolean; row?: BoardRow };

const input = z.object({
  itemId: z.uuid(),
  availability: z.enum(["available", "limited", "unavailable"]),
  note: z.string().trim().max(140).nullish(),
  remainingQty: z.number().int().min(0).max(9999).nullish(),
  until: z.enum(["service", "tonight", "manual"]).default("tonight"),
  expectedUpdatedAt: z.string().nullish(),
});

const COLUMNS =
  "id, availability, availability_note, remaining_qty, availability_until, updated_at";

/** The 86 board's one write. Allowed for owner, admin and staff (enforced by the RPC + RLS). */
export async function setAvailability(
  raw: z.input<typeof input>,
): Promise<ActionResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const ctx = await getStaffContext();
  const v = parsed.data;
  const until =
    v.availability === "available"
      ? null
      : computeUntil(
          v.until,
          new Date(),
          ctx.restaurant.timezone,
          ctx.restaurant.hours_json,
        );

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .rpc("set_item_availability", {
      p_item_id: v.itemId,
      p_availability: v.availability,
      p_note: v.note ?? undefined,
      p_remaining_qty: v.remainingQty ?? undefined,
      p_until: until?.toISOString(),
      p_expected_updated_at: v.expectedUpdatedAt ?? undefined,
    })
    .single();

  if (error) {
    if (error.code === "40001") {
      const { data: current } = await supabase
        .from("items")
        .select(COLUMNS)
        .eq("id", v.itemId)
        .single();
      return {
        ok: false,
        conflict: true,
        error: "Someone else just changed this dish.",
        row: current ?? undefined,
      };
    }
    return {
      ok: false,
      error: "Couldn't save. Check your connection and try again.",
    };
  }
  // Expire the public menu immediately so the next diner sees the change.
  revalidateTag(menuTag(ctx.restaurant.slug), { expire: 0 });
  return { ok: true, row: data as BoardRow };
}

/** "Reset all to available" — owner/admin only (the RPC re-checks). */
export async function resetAllAvailability(): Promise<{
  ok: boolean;
  count?: number;
  error?: string;
}> {
  const ctx = await getStaffContext();
  if (ctx.profile.role === "staff") return { ok: false, error: "Not allowed." };
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("reset_all_availability", {
    p_restaurant_id: ctx.restaurant.id,
  });
  if (error) return { ok: false, error: "Couldn't reset. Try again." };
  revalidateTag(menuTag(ctx.restaurant.slug), { expire: 0 });
  return { ok: true, count: data ?? 0 };
}
