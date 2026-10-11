// Mirror of the SQL ordering rule in public.menu_json (supabase/migrations/*_rpc.sql).
// Used to re-sort a category client-side when a realtime update flips an item's availability.
// Rule: available → limited → unavailable, then sort_order, then name.

export type Availability = "available" | "limited" | "unavailable";

export const AVAILABILITY_RANK: Record<Availability, number> = {
  available: 0,
  limited: 1,
  unavailable: 2,
};

export interface Orderable {
  availability: Availability;
  sort_order: number;
  name: string;
}

export function compareMenuItems(a: Orderable, b: Orderable): number {
  return (
    AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability] ||
    a.sort_order - b.sort_order ||
    // Postgres sorts text by collation; for display parity we compare by code point too.
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  );
}

export function sortMenuItems<T extends Orderable>(items: readonly T[]): T[] {
  return [...items].sort(compareMenuItems);
}
