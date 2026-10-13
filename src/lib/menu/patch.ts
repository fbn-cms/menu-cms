import type { AvailabilityPatch } from "./types";

// Hand-written guard for realtime payloads: runs in the browser, where we don't ship Zod.
const STATES = new Set(["available", "limited", "unavailable"]);
const strOrNull = (v: unknown) => v === null || typeof v === "string";

export function parseAvailabilityPatch(
  payload: unknown,
): AvailabilityPatch | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (
    typeof p.id !== "string" ||
    typeof p.category_id !== "string" ||
    typeof p.availability !== "string" ||
    !STATES.has(p.availability) ||
    !strOrNull(p.availability_note) ||
    !strOrNull(p.availability_until) ||
    !(p.remaining_qty === null || Number.isInteger(p.remaining_qty)) ||
    !(p.is_featured === undefined || typeof p.is_featured === "boolean")
  ) {
    return null;
  }
  return p as AvailabilityPatch;
}
