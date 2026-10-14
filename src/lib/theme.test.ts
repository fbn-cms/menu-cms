import { describe, expect, test } from "vitest";
import {
  checkTheme,
  contrast,
  deriveTheme,
  DEFAULT_THEME,
  PRESETS,
  readTheme,
  type ThemeInput,
} from "./theme";

const full = (p: (typeof PRESETS)[number]): ThemeInput => ({
  ...DEFAULT_THEME,
  ...p,
});

describe("theme", () => {
  test.each(PRESETS)("preset $label passes the readability checks", (p) => {
    expect(checkTheme(full(p))).toEqual([]);
  });

  test.each(PRESETS)(
    "preset $label: secondary text is AA on every surface",
    (p) => {
      const v = deriveTheme(full(p));
      for (const [fg, bg] of [
        ["--muted-foreground", "--background"],
        ["--panel-muted-foreground", "--panel-solid"],
        ["--card-muted-foreground", "--card"],
        ["--chrome-muted-foreground", "--chrome-solid"],
        ["--primary-foreground", "--primary"],
      ] as const) {
        expect(contrast(v[fg], v[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    },
  );

  test("pattern presets: cards opaque & light, panels translucent, pattern URL set", () => {
    const v = deriveTheme(
      full(PRESETS.find((p) => p.preset === "navy-burgundy")!),
    );
    expect(v["--page-pattern"]).toBe('url("/patterns/navy-burgundy.webp")');
    expect(v["--panel"]).toMatch(/\/ 0\.86\)$/);
    expect(v["--card-foreground"]).toBe("#162341"); // brand navy text on ivory cards
  });

  test("themes saved before panels/cards existed keep the original look", () => {
    const t = readTheme({
      preset: "saffron",
      background: "#fff8ec",
      foreground: "#2b1d0e",
      accent: "#9a3412",
    });
    expect(t.pattern).toBeNull();
    expect(t.card).toBe("#fff8ec");
    expect(t.panelOpacity).toBe(1);
    expect(deriveTheme(t)["--chrome-solid"]).toBe("#fff8ec"); // header etc. unchanged
  });

  test("low-contrast picks are rejected", () => {
    const problems = checkTheme({
      ...DEFAULT_THEME,
      foreground: "#bbbbbb",
      accent: "#fafafa",
    });
    expect(problems.map((p) => p.field)).toEqual(
      expect.arrayContaining(["foreground", "accent"]),
    );
  });

  test("a see-through panel over a pattern is rejected", () => {
    const t = { ...full(PRESETS.find((p) => p.pattern)!), panelOpacity: 0.6 };
    expect(checkTheme(t).some((p) => p.field === "panel")).toBe(true);
  });

  test("stored JSON is read defensively (no CSS injection, unknown pattern ignored)", () => {
    const t = readTheme({
      background: "red;}body{display:none",
      foreground: "#000000",
      accent: 42,
      pattern: "../../evil",
      panelOpacity: 5,
    });
    expect(t.background).toBe("#ffffff");
    expect(t.accent).toBe("#171717");
    expect(t.pattern).toBeNull();
    expect(t.panelOpacity).toBe(1);
  });
});
