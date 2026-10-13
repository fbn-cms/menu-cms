import { expect, test } from "vitest";
import { parsePriceToCents, slugify } from "./text";

test.each([
  ["Saffron Crème Brûlée", "saffron-creme-brulee"],
  ["Fish & Chips", "fish-and-chips"],
  ["  Koobideh   Kebab!! ", "koobideh-kebab"],
  ["کباب", ""],
])("slugify(%s) = %s", (a, b) => expect(slugify(a)).toBe(b));

test.each([
  ["12", 1200],
  ["12.5", 1250],
  ["12,50", 1250],
  ["$9.99", 999],
  ["0", 0],
  ["abc", null],
  ["12.345", null],
  ["-3", null],
])("parsePriceToCents(%s) = %s", (a, b) =>
  expect(parsePriceToCents(a)).toBe(b),
);
