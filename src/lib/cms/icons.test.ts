import { expect, test } from "vitest";
import { ICON_NAMES, suggestIcon } from "./icons";

test.each([
  ["Vegan", "vegan"],
  ["Végétarien", "carrot"],
  ["Gluten-free", "wheat-off"],
  ["Gluten", "wheat"],
  ["Tree nuts", "nut"],
  ["Peanuts", "nut"],
  ["Sesame", "circle-dot"],
  ["Halal", "badge-check"],
  ["Extra spicy", "flame"],
  ["Chef's pick", "chef-hat"],
  ["Shellfish", "shell"],
  ["بدون گلوتن", "wheat-off"],
  ["حلال", "badge-check"],
  ["Sans lactose", "milk-off"],
])("%s → %s", (label, icon) => {
  expect(suggestIcon(label)).toBe(icon);
});

test("no guess for unknown labels", () => {
  expect(suggestIcon("Grandma's recipe")).toBeNull();
  expect(suggestIcon("  ")).toBeNull();
});

test("every suggestion is in the catalogue", () => {
  for (const l of ["vegan", "fish", "beer", "soup", "kids menu", "organic"]) {
    const icon = suggestIcon(l);
    if (icon) expect(ICON_NAMES).toContain(icon);
  }
});
