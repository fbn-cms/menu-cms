import { expect, test } from "vitest";
import { parseAvailabilityPatch } from "./patch";
import { availabilityPatchSchema } from "./types";

const good = {
  id: "a",
  category_id: "c",
  availability: "unavailable",
  availability_note: null,
  remaining_qty: null,
  availability_until: null,
};

test("accepts what the Zod schema accepts", () => {
  expect(availabilityPatchSchema.safeParse(good).success).toBe(true);
  expect(parseAvailabilityPatch(good)).toEqual(good);
});

test.each([
  null,
  "x",
  { ...good, availability: "gone" },
  { ...good, id: 1 },
  { ...good, remaining_qty: 1.5 },
  { ...good, availability_note: 3 },
])("rejects malformed payload %#", (bad) => {
  expect(parseAvailabilityPatch(bad)).toBeNull();
});
