// Restaurant colour theme: the owner picks 3 colours (background, text, accent); everything
// else is derived so the menu always stays readable (WCAG AA). Client-safe (no Zod).

export type ThemeInput = {
  preset: string;
  background: string;
  foreground: string;
  accent: string;
  showName: boolean;
  /** Intrinsic logo size, so the header reserves the right space (no layout shift). */
  logoWidth: number | null;
  logoHeight: number | null;
};

export const PRESETS: (Pick<
  ThemeInput,
  "preset" | "background" | "foreground" | "accent"
> & { label: string })[] = [
  {
    preset: "classic",
    label: "Classic",
    background: "#ffffff",
    foreground: "#171717",
    accent: "#171717",
  },
  {
    preset: "saffron",
    label: "Saffron",
    background: "#fff8ec",
    foreground: "#2b1d0e",
    accent: "#9a3412",
  },
  {
    preset: "pistachio",
    label: "Pistachio",
    background: "#f4f7ee",
    foreground: "#1c2a1a",
    accent: "#3f6212",
  },
  {
    preset: "pomegranate",
    label: "Pomegranate",
    background: "#fff5f6",
    foreground: "#2a0f12",
    accent: "#9f1239",
  },
  {
    preset: "midnight",
    label: "Midnight",
    background: "#121418",
    foreground: "#f3f4f6",
    accent: "#f59e0b",
  },
];

export const DEFAULT_THEME: ThemeInput = {
  ...PRESETS[0]!,
  showName: true,
  logoWidth: null,
  logoHeight: null,
};

const HEX = /^#[0-9a-f]{6}$/i;
const dim = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 4096 ? v : null;
export const isHex = (v: unknown): v is string =>
  typeof v === "string" && HEX.test(v);

/** Read a stored theme_json defensively; anything invalid falls back to the default. */
export function readTheme(json: unknown): ThemeInput {
  const t = (json ?? {}) as Partial<Record<keyof ThemeInput, unknown>>;
  return {
    preset: typeof t.preset === "string" ? t.preset.slice(0, 20) : "custom",
    background: isHex(t.background)
      ? t.background.toLowerCase()
      : DEFAULT_THEME.background,
    foreground: isHex(t.foreground)
      ? t.foreground.toLowerCase()
      : DEFAULT_THEME.foreground,
    accent: isHex(t.accent) ? t.accent.toLowerCase() : DEFAULT_THEME.accent,
    showName: typeof t.showName === "boolean" ? t.showName : true,
    logoWidth: dim(t.logoWidth),
    logoHeight: dim(t.logoHeight),
  };
}

// ---------------------------------------------------------------- colour maths
type RGB = [number, number, number];
const toRgb = (hex: string): RGB =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const toHex = (rgb: RGB) =>
  "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/** Mix a toward b by t (0..1). */
export const mix = (a: string, b: string, t: number) => {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as RGB);
};

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

/** Full set of CSS variables for the public menu, derived from the 3 picked colours. */
export function deriveTheme(t: ThemeInput) {
  const { background: bg, foreground: fg, accent } = t;
  const muted = mix(bg, fg, 0.06);
  // Secondary text: as soft as possible while keeping ≥ 4.6:1 on both background and muted.
  let soft = 0.45;
  let mutedFg = mix(fg, bg, soft);
  while (
    soft > 0 &&
    Math.min(contrast(mutedFg, bg), contrast(mutedFg, muted)) < 4.6
  ) {
    soft -= 0.05;
    mutedFg = mix(fg, bg, Math.max(soft, 0));
  }
  const accentFg =
    contrast("#ffffff", accent) >= contrast("#111111", accent)
      ? "#ffffff"
      : "#111111";
  return {
    "--background": bg,
    "--foreground": fg,
    "--card": bg,
    "--card-foreground": fg,
    "--popover": bg,
    "--popover-foreground": fg,
    "--muted": muted,
    "--muted-foreground": mutedFg,
    "--secondary": muted,
    "--secondary-foreground": fg,
    "--border": mix(bg, fg, 0.14),
    "--input": mix(bg, fg, 0.18),
    "--ring": accent,
    "--primary": accent,
    "--primary-foreground": accentFg,
  } as const;
}

export type ThemeProblem = { field: "foreground" | "accent"; message: string };

/** Readability checks the settings page enforces before saving. */
export function checkTheme(t: ThemeInput): ThemeProblem[] {
  const problems: ThemeProblem[] = [];
  const c = contrast(t.foreground, t.background);
  if (c < 7) {
    problems.push({
      field: "foreground",
      message: `Text on background is ${c.toFixed(1)}:1 — needs at least 7:1 so small text stays readable in dim light.`,
    });
  }
  const a = contrast(t.accent, t.background);
  if (a < 3) {
    problems.push({
      field: "accent",
      message: `Accent on background is ${a.toFixed(1)}:1 — needs at least 3:1 so buttons stand out.`,
    });
  }
  const accentFg = deriveTheme(t)["--primary-foreground"];
  if (contrast(accentFg, t.accent) < 4.5) {
    problems.push({
      field: "accent",
      message:
        "Text on the accent colour would be hard to read — pick a darker or lighter accent.",
    });
  }
  return problems;
}
