import { describe, expect, test } from "vitest";
import { sortMenuItems, type Orderable } from "./ordering";

const item = (
  name: string,
  availability: Orderable["availability"],
  sort_order: number,
) => ({
  name,
  availability,
  sort_order,
});

describe("menu ordering rule", () => {
  test("availability beats sort_order", () => {
    const sorted = sortMenuItems([
      item("Soup", "unavailable", 0),
      item("Mirza", "limited", 2),
      item("Shirazi", "available", 3),
      item("Kashk", "available", 1),
    ]);
    expect(sorted.map((i) => i.name)).toEqual([
      "Kashk",
      "Shirazi",
      "Mirza",
      "Soup",
    ]);
  });

  test("ties on availability and sort_order fall back to name", () => {
    const sorted = sortMenuItems([
      item("Saffron Ice Cream", "available", 5),
      item("Faloodeh", "available", 5),
    ]);
    expect(sorted.map((i) => i.name)).toEqual([
      "Faloodeh",
      "Saffron Ice Cream",
    ]);
  });

  test("an item that sells out sinks to the bottom of its category", () => {
    const before = [
      item("A", "available", 1),
      item("B", "available", 2),
      item("C", "limited", 3),
    ];
    const after = sortMenuItems(
      before.map((i) =>
        i.name === "A" ? { ...i, availability: "unavailable" as const } : i,
      ),
    );
    expect(after.map((i) => i.name)).toEqual(["B", "C", "A"]);
  });
});
