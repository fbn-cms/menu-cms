// Restaurant colour theme. The owner picks a palette (or individual colours) and optionally a
// background pattern; everything else is derived so the menu always stays readable (WCAG AA).
//
// Three surfaces sit on the page background:
//   chrome — header, category bar, search/filters, footer
//   panel  — each menu section (Starters, Mains…); translucent over a pattern
//   card   — each dish; always opaque, never shows the pattern
// Client-safe (no Zod).

// ---------------------------------------------------------------- colour maths
type RGB = [number, number, number];
const toRgb = (hex: string): RGB =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const toHex = (rgb: RGB) =>
  "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
const rgba = (hex: string, a: number) => `rgb(${toRgb(hex).join(" ")} / ${a})`;

/** Mix a toward b by t (0..1). */
export function mix(a: string, b: string, t: number) {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as RGB);
}

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (l1 + 0.05) / (l2 + 0.05);
}

export const isDark = (hex: string) => luminance(hex) < 0.2;

export type PatternId = "cobalt-tangerine" | "mint-gold" | "navy-burgundy";

export const PATTERNS: {
  id: PatternId;
  label: string;
  file: string;
  size: number;
}[] = [
  // size = displayed tile width in CSS px (source tiles are larger, so they stay crisp)
  {
    id: "cobalt-tangerine",
    label: "Cobalt & Tangerine",
    file: "/patterns/cobalt-tangerine.webp",
    size: 250,
  },
  {
    id: "mint-gold",
    label: "Mint & Antique Gold",
    file: "/patterns/mint-gold.webp",
    size: 180,
  },
  {
    id: "navy-burgundy",
    label: "Navy & Burgundy",
    file: "/patterns/navy-burgundy.webp",
    size: 220,
  },
];
const isPattern = (v: unknown): v is PatternId =>
  PATTERNS.some((p) => p.id === v);

export type ThemeInput = {
  preset: string;
  background: string;
  foreground: string;
  accent: string;
  /** Background pattern behind everything, or null for a plain colour. */
  pattern: PatternId | null;
  /** Section panel colour and its opacity (translucent over a pattern). */
  panel: string;
  panelOpacity: number;
  /** Dish card colour (opaque). */
  card: string;
  showName: boolean;
  /** Intrinsic logo size, so the header reserves the right space (no layout shift). */
  logoWidth: number | null;
  logoHeight: number | null;
  /** Name in the footer's "© year … All rights reserved." Empty → the restaurant name. */
  copyrightHolder: string;
};

type PresetColours = Pick<
  ThemeInput,
  | "preset"
  | "background"
  | "foreground"
  | "accent"
  | "pattern"
  | "panel"
  | "panelOpacity"
  | "card"
>;

/** Plain palettes: panel and card follow the background (the original look). */
const plain = (
  preset: string,
  background: string,
  foreground: string,
  accent: string,
): PresetColours => ({
  preset,
  background,
  foreground,
  accent,
  pattern: null,
  panel: mix(background, foreground, 0.03),
  panelOpacity: 1,
  card: background,
});

export const PRESETS: (PresetColours & { label: string })[] = [
  { ...plain("classic", "#ffffff", "#171717", "#171717"), label: "Classic" },
  { ...plain("saffron", "#fff8ec", "#2b1d0e", "#9a3412"), label: "Saffron" },
  {
    ...plain("pistachio", "#f4f7ee", "#1c2a1a", "#3f6212"),
    label: "Pistachio",
  },
  {
    ...plain("pomegranate", "#fff5f6", "#2a0f12", "#9f1239"),
    label: "Pomegranate",
  },
  { ...plain("midnight", "#121418", "#f3f4f6", "#f59e0b"), label: "Midnight" },
  // Owner-supplied patterns + palettes (2026-10-14). Colours sampled from the artwork, adjusted
  // for contrast: deep panels for text over the pattern, light opaque cards for the dishes.
  {
    preset: "cobalt-tangerine",
    label: "Cobalt & Tangerine",
    background: "#1e3f7a",
    foreground: "#f4f8fc",
    accent: "#ffc260",
    pattern: "cobalt-tangerine",
    panel: "#10264f",
    panelOpacity: 0.86,
    card: "#fff6e6",
  },
  {
    preset: "mint-gold",
    label: "Mint & Antique Gold",
    background: "#313154",
    foreground: "#f3f1e6",
    accent: "#bfb681",
    pattern: "mint-gold",
    panel: "#232340",
    panelOpacity: 0.86,
    card: "#eef4ee",
  },
  {
    preset: "navy-burgundy",
    label: "Navy & Burgundy",
    background: "#162341",
    foreground: "#f5eedc",
    accent: "#c8924f",
    pattern: "navy-burgundy",
    panel: "#0f182e",
    panelOpacity: 0.86,
    card: "#f6efdd",
  },
];

export const DEFAULT_THEME: ThemeInput = {
  ...PRESETS[0]!,
  showName: true,
  logoWidth: null,
  logoHeight: null,
  copyrightHolder: "",
};

const HEX = /^#[0-9a-f]{6}$/i;
const dim = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 4096 ? v : null;
export const isHex = (v: unknown): v is string =>
  typeof v === "string" && HEX.test(v);
const opacity = (v: unknown) =>
  typeof v === "number" && v >= 0.5 && v <= 1
    ? Math.round(v * 100) / 100
    : null;

/** Read a stored theme_json defensively; anything invalid falls back to a safe default. */
export function readTheme(json: unknown): ThemeInput {
  const t = (json ?? {}) as Partial<Record<keyof ThemeInput, unknown>>;
  const background = isHex(t.background)
    ? t.background.toLowerCase()
    : DEFAULT_THEME.background;
  const foreground = isHex(t.foreground)
    ? t.foreground.toLowerCase()
    : DEFAULT_THEME.foreground;
  return {
    preset: typeof t.preset === "string" ? t.preset.slice(0, 20) : "custom",
    background,
    foreground,
    accent: isHex(t.accent) ? t.accent.toLowerCase() : DEFAULT_THEME.accent,
    pattern: isPattern(t.pattern) ? t.pattern : null,
    // Themes saved before panels/cards existed keep their original look.
    panel: isHex(t.panel)
      ? t.panel.toLowerCase()
      : mix(background, foreground, 0.03),
    panelOpacity: opacity(t.panelOpacity) ?? 1,
    card: isHex(t.card) ? t.card.toLowerCase() : background,
    showName: typeof t.showName === "boolean" ? t.showName : true,
    logoWidth: dim(t.logoWidth),
    logoHeight: dim(t.logoHeight),
    copyrightHolder:
      typeof t.copyrightHolder === "string"
        ? t.copyrightHolder.slice(0, 80)
        : "",
  };
}

/** Best text colour for a surface: prefer the palette's own colours, else near-black/white. */
function textOn(surface: string, preferred: string[]): string {
  const brand = preferred
    .map((c) => ({ c, r: contrast(c, surface) }))
    .sort((a, b) => b.r - a.r)[0];
  if (brand && brand.r >= 7) return brand.c;
  return contrast("#ffffff", surface) >= contrast("#111111", surface)
    ? "#ffffff"
    : "#111111";
}

/** Secondary text: as soft as possible while keeping ≥ 4.6:1 on the surface and its muted tint. */
function softText(fg: string, surface: string, muted: string) {
  let soft = 0.45;
  let out = mix(fg, surface, soft);
  while (
    soft > 0 &&
    Math.min(contrast(out, surface), contrast(out, muted)) < 4.6
  ) {
    soft -= 0.05;
    out = mix(fg, surface, Math.max(soft, 0));
  }
  return out;
}

/** Surface colours. `fixedFg` = the owner's own text colour, used as chosen (checked, not swapped). */
function surface(base: string, preferred: string[], fixedFg?: string) {
  const fg = fixedFg ?? textOn(base, preferred);
  const muted = mix(base, fg, 0.06);
  return {
    fg,
    muted,
    mutedFg: softText(fg, base, muted),
    border: mix(base, fg, 0.16),
  };
}

/** Full set of CSS variables for the public menu, derived from the theme. */
export function deriveTheme(t: ThemeInput) {
  const { background: bg, foreground: fg, accent } = t;
  const page = surface(bg, [fg], fg);
  const panel = surface(t.panel, [fg, bg]);
  const card = surface(t.card, [fg, bg]);
  const pattern = PATTERNS.find((p) => p.id === t.pattern);
  const accentFg =
    contrast("#ffffff", accent) >= contrast("#111111", accent)
      ? "#ffffff"
      : "#111111";
  // With a pattern, header/nav/footer use the panel look so text never sits on the artwork.
  const chrome = pattern
    ? { base: t.panel, a: t.panelOpacity, s: panel }
    : { base: bg, a: 1, s: page };
  return {
    "--background": bg,
    "--foreground": page.fg,
    "--muted": page.muted,
    "--muted-foreground": page.mutedFg,
    "--secondary": page.muted,
    "--secondary-foreground": page.fg,
    "--border": page.border,
    "--input": mix(bg, page.fg, 0.18),
    "--popover": bg,
    "--popover-foreground": page.fg,
    "--ring": accent,
    "--primary": accent,
    "--primary-foreground": accentFg,
    "--page-pattern": pattern ? `url("${pattern.file}")` : "none",
    "--page-pattern-size": pattern ? `${pattern.size}px` : "auto",
    "--panel": rgba(t.panel, t.panelOpacity),
    "--panel-solid": t.panel,
    "--panel-foreground": panel.fg,
    "--panel-muted": panel.muted,
    "--panel-muted-foreground": panel.mutedFg,
    "--panel-border": panel.border,
    "--chrome": rgba(chrome.base, chrome.a),
    "--chrome-solid": chrome.base,
    "--chrome-foreground": chrome.s.fg,
    "--chrome-muted": chrome.s.muted,
    "--chrome-muted-foreground": chrome.s.mutedFg,
    "--chrome-border": chrome.s.border,
    "--card": t.card,
    "--card-foreground": card.fg,
    "--card-muted": card.muted,
    "--card-muted-foreground": card.mutedFg,
    "--card-border": card.border,
  } as const;
}

/** Dark-mode badge colours follow the dish cards, where the badges live. */
export const cardsAreDark = (t: ThemeInput) => isDark(t.card);

export type ThemeProblem = {
  field: "foreground" | "accent" | "panel" | "card";
  message: string;
};

/** Readability checks the settings page enforces before saving. */
export function checkTheme(t: ThemeInput): ThemeProblem[] {
  const problems: ThemeProblem[] = [];
  const v = deriveTheme(t);
  const c = contrast(v["--foreground"], t.background);
  if (c < 7) {
    problems.push({
      field: "foreground",
      message: `Text on background is ${c.toFixed(1)}:1 — needs at least 7:1 so small text stays readable in dim light.`,
    });
  }
  // Buttons/chips sit on the page or on panels.
  const a = Math.min(
    contrast(t.accent, t.background),
    contrast(t.accent, t.panel),
  );
  if (a < 3) {
    problems.push({
      field: "accent",
      message: `The accent doesn't stand out enough on the background or panels (${a.toFixed(1)}:1, needs 3:1).`,
    });
  }
  if (contrast(v["--primary-foreground"], t.accent) < 4.5) {
    problems.push({
      field: "accent",
      message:
        "Text on the accent colour would be hard to read — pick a darker or lighter accent.",
    });
  }
  // Over a busy pattern, panels must be nearly opaque and their text extra-strong.
  if (t.pattern && t.panelOpacity < 0.75) {
    problems.push({
      field: "panel",
      message:
        "With a pattern, panels need at least 75% opacity so text stays readable.",
    });
  }
  const p = contrast(v["--panel-foreground"], t.panel);
  if (p < (t.pattern ? 7 : 4.5)) {
    problems.push({
      field: "panel",
      message: `Text on the section panels would be ${p.toFixed(1)}:1 — pick a darker or lighter panel colour.`,
    });
  }
  const k = contrast(v["--card-foreground"], t.card);
  if (k < 7) {
    problems.push({
      field: "card",
      message: `Text on dish cards would be ${k.toFixed(1)}:1 — needs 7:1. Pick a lighter or darker card colour.`,
    });
  }
  return problems;
}
