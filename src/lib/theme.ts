// Restaurant colour theme. The owner picks a palette (or individual colours) and optionally a
// background pattern; everything else is derived so the menu always stays readable (WCAG AA).
//
// Surfaces:
//   chrome — header, category bar, search/filters, footer
//   panel  — each menu section (Starters, Mains…)
//   card   — the dishes; always opaque
// With a pattern the owner picks one of two layouts; in both, text never sits on the artwork.
//   frieze — the artwork frames the menu (a masthead band, a closing frieze, toned-down margins
//            on wide screens). Sections drop their boxes; each becomes one opaque sheet of
//            dishes split by hairlines. Suits the deep palettes.
//   panels — the classic bordered section panels and dish cards on a pale page. Inside each
//            panel, between its border and the cards, the artwork shows washed out in the panel
//            colour (panelOpacity = wash strength). Header and footer get the same wash.
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
    size: 200,
  },
  {
    id: "mint-gold",
    label: "Mint & Antique Gold",
    file: "/patterns/mint-gold.webp",
    size: 150,
  },
  {
    id: "navy-burgundy",
    label: "Navy & Burgundy",
    file: "/patterns/navy-burgundy.webp",
    size: 180,
  },
];
const isPattern = (v: unknown): v is PatternId =>
  PATTERNS.some((p) => p.id === v);

export type PatternLayout = "frieze" | "panels";
export const PATTERN_LAYOUTS: PatternLayout[] = ["frieze", "panels"];

export type ThemeInput = {
  preset: string;
  background: string;
  foreground: string;
  accent: string;
  /** Background pattern behind everything, or null for a plain colour. */
  pattern: PatternId | null;
  /** How a pattern is used (ignored without one). */
  layout: PatternLayout;
  /** Section panel colour and its opacity — with the panels layout, how strongly the panel
   *  colour washes over the artwork. */
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
  | "layout"
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
  layout: "frieze",
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
  // for contrast: a deep page colour from the artwork, light opaque sheets for the dishes.
  // (panel/panelOpacity only matter if the owner later switches the pattern off.)
  {
    preset: "cobalt-tangerine",
    label: "Cobalt & Tangerine",
    background: "#1e3f7a",
    foreground: "#f4f8fc",
    accent: "#ffc260",
    pattern: "cobalt-tangerine",
    layout: "frieze",
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
    layout: "frieze",
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
    layout: "frieze",
    panel: "#0f182e",
    panelOpacity: 0.86,
    card: "#f6efdd",
  },
  // Pale "panels" variants: washed palette colours for the page, the artwork washed out inside
  // the section panels, white-ish solid dish cards, the deepest artwork colour as the accent.
  {
    preset: "cobalt-pale",
    label: "Cobalt & Tangerine · Pale",
    background: "#f3f6fb",
    foreground: "#142b57",
    accent: "#1f4e9c",
    pattern: "cobalt-tangerine",
    layout: "panels",
    panel: "#e3ebf6",
    panelOpacity: 0.8,
    card: "#ffffff",
  },
  {
    preset: "mint-pale",
    label: "Mint & Antique Gold · Pale",
    background: "#f3f3ec",
    foreground: "#26263f",
    accent: "#6b6343",
    pattern: "mint-gold",
    layout: "panels",
    panel: "#e4eae1",
    panelOpacity: 0.84,
    card: "#fffffb",
  },
  {
    preset: "navy-pale",
    label: "Navy & Burgundy · Pale",
    background: "#f8f3e8",
    foreground: "#162341",
    accent: "#6e1d3f",
    pattern: "navy-burgundy",
    layout: "panels",
    panel: "#eee4d0",
    panelOpacity: 0.69, // owner asked for 15 points less wash (2026-10-22)
    card: "#fffdf7",
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
    layout: t.layout === "panels" ? "panels" : "frieze",
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
  const frieze = pattern && t.layout === "frieze";
  const panels = pattern && t.layout === "panels";
  // Frieze: header/nav/footer and sections sit on the solid page colour; the artwork only
  // appears in its own bands. Panels: solid panel colour (title strip), artwork washed below.
  const sec = frieze
    ? { base: bg, a: 0, s: page }
    : { base: t.panel, a: panels ? 1 : t.panelOpacity, s: panel };
  const wash = (ground: string) =>
    pattern
      ? `linear-gradient(${rgba(ground, t.panelOpacity)}, ${rgba(ground, t.panelOpacity)}), url("${pattern.file}")`
      : "none";
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
    // Page margins (visible beside the menu column on tablets/desktops): the artwork toned
    // down under a wash of the page colour, so it reads as texture rather than noise.
    "--page-pattern": frieze
      ? `linear-gradient(${rgba(bg, 0.8)}, ${rgba(bg, 0.8)}), url("${pattern.file}")`
      : "none",
    "--page-pattern-size": frieze ? `auto, ${pattern.size}px` : "auto",
    // Bands (masthead, footer strip): full strength for frieze, washed for panels. Ground shows
    // through artwork with a transparent background (Cobalt & Tangerine, drawn on white).
    "--band-pattern": !pattern
      ? "none"
      : panels
        ? wash(t.panel)
        : `url("${pattern.file}")`,
    "--band-pattern-size": !pattern
      ? "auto"
      : panels
        ? `auto, ${pattern.size}px`
        : `${pattern.size}px`,
    "--band-ground": panels ? t.panel : t.card,
    // Panels layout: the artwork washed in the panel colour, between panel border and cards.
    "--wash-pattern": panels ? wash(t.panel) : "none",
    "--wash-pattern-size": panels ? `auto, ${pattern.size}px` : "auto",
    "--panel": rgba(sec.base, sec.a),
    "--panel-solid": sec.base,
    "--panel-foreground": sec.s.fg,
    "--panel-muted": sec.s.muted,
    "--panel-muted-foreground": sec.s.mutedFg,
    "--panel-border": sec.s.border,
    "--chrome": bg,
    "--chrome-solid": bg,
    "--chrome-foreground": page.fg,
    "--chrome-muted": page.muted,
    "--chrome-muted-foreground": page.mutedFg,
    "--chrome-border": page.border,
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
  const frieze = t.pattern != null && t.layout === "frieze";
  // Buttons/chips sit on the page or (except in the frieze layout) on panels.
  const a = Math.min(
    contrast(t.accent, t.background),
    frieze ? Infinity : contrast(t.accent, t.panel),
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
  // Frieze: sections sit on the page colour (already checked above). Panels: section titles sit
  // on the solid panel strip next to the artwork, so they need the stronger 7:1.
  const p = contrast(v["--panel-foreground"], t.panel);
  if (!frieze && p < (t.pattern ? 7 : 4.5)) {
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
