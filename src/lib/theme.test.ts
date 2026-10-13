import { describe, expect, test } from "vitest";
import { checkTheme, contrast, deriveTheme, PRESETS, readTheme } from "./theme";

describe("theme", () => {
  test.each(PRESETS)("preset $label passes the readability checks", (p) => {
    expect(
      checkTheme({
        ...p,
        showName: true,
        logoWidth: null,
        logoHeight: null,
        copyrightHolder: "",
      }),
    ).toEqual([]);
  });

  test.each(PRESETS)(
    "preset $label derives AA secondary text on background and muted",
    (p) => {
      const v = deriveTheme({
        ...p,
        showName: true,
        logoWidth: null,
        logoHeight: null,
        copyrightHolder: "",
      });
      expect(
        contrast(v["--muted-foreground"], v["--background"]),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(v["--muted-foreground"], v["--muted"]),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(v["--primary-foreground"], v["--primary"]),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  test("low-contrast picks are rejected", () => {
    const problems = checkTheme({
      preset: "custom",
      background: "#ffffff",
      foreground: "#bbbbbb",
      accent: "#fafafa",
      showName: true,
      logoWidth: null,
      logoHeight: null,
      copyrightHolder: "",
    });
    expect(problems.map((p) => p.field)).toEqual(["foreground", "accent"]);
  });

  test("stored JSON is read defensively (no CSS injection)", () => {
    const t = readTheme({
      background: "red;}body{display:none",
      foreground: "#000000",
      accent: 42,
    });
    expect(t.background).toBe("#ffffff");
    expect(t.accent).toBe("#171717");
    expect(t.foreground).toBe("#000000");
  });
});
