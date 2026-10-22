import { expect, test } from "vitest";
import { withEffectiveAvailability } from "./effective";

const NOW = new Date("2026-10-22T20:00:00Z");
const row = (
  availability: "limited" | "unavailable",
  until: string | null,
) => ({
  id: "x",
  availability,
  availability_note: "back soon",
  remaining_qty: 2,
  availability_until: until,
});

test("an expired 'until' reads as available, with the note cleared", () => {
  expect(
    withEffectiveAvailability(row("unavailable", "2026-10-22T08:00:00Z"), NOW),
  ).toEqual({
    id: "x",
    availability: "available",
    availability_note: null,
    remaining_qty: null,
    availability_until: null,
  });
});

test("a future 'until' or no end time stays as set", () => {
  const future = row("limited", "2026-10-23T08:00:00Z");
  expect(withEffectiveAvailability(future, NOW)).toBe(future);
  const manual = row("unavailable", null);
  expect(withEffectiveAvailability(manual, NOW)).toBe(manual);
});
