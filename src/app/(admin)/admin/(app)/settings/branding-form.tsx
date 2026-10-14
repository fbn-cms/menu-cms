"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  CircleCheck,
  Hourglass,
  ImageUp,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveBranding } from "@/lib/actions/settings";
import { resizeToWebp } from "@/lib/images/client-resize";
import { imageUrl } from "@/lib/menu/image";
import {
  checkTheme,
  deriveTheme,
  cardsAreDark,
  PATTERNS,
  type PatternId,
  PRESETS,
  type ThemeInput,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

type Initial = {
  name: string;
  address: string;
  phone: string;
  logoKey: string | null;
  theme: ThemeInput;
  updatedAt: string;
};
const LOGO_MAX_SIDE = 512;

export function BrandingForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [logoKey, setLogoKey] = useState(initial.logoKey);
  const [theme, setTheme] = useState<ThemeInput>(initial.theme);
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const problems = useMemo(() => checkTheme(theme), [theme]);
  const vars = useMemo(() => deriveTheme(theme), [theme]);
  const set = (patch: Partial<ThemeInput>) =>
    setTheme((t) => ({ ...t, ...patch }));
  const dirty =
    name !== initial.name ||
    address !== initial.address ||
    phone !== initial.phone ||
    logoKey !== initial.logoKey ||
    JSON.stringify(theme) !== JSON.stringify(initial.theme);

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const webp = await resizeToWebp(file, LOGO_MAX_SIDE, 0.9);
      const res = await fetch("/api/admin/images?kind=logo", {
        method: "POST",
        headers: { "Content-Type": "image/webp" },
        body: webp,
      });
      const body = (await res.json()) as {
        key?: string;
        width?: number;
        height?: number;
        error?: string;
      };
      if (!res.ok || !body.key) throw new Error(body.error ?? "Upload failed.");
      setLogoKey(body.key);
      set({ logoWidth: body.width ?? null, logoHeight: body.height ?? null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = () =>
    startSave(async () => {
      const res = await saveBranding({
        name,
        address,
        phone,
        logoKey,
        theme,
        expectedUpdatedAt: initial.updatedAt,
      });
      if (res.ok) {
        toast.success("Saved — the menu is updated.");
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="grid gap-6 pt-2 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Name */}
        <section
          aria-labelledby="s-name"
          className="space-y-3 rounded-2xl border p-4"
        >
          <h2 id="s-name" className="font-semibold">
            Name
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name of the place</Label>
            <Input
              id="name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              className="h-11 text-base"
            />
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={theme.showName}
              onChange={(e) => set({ showName: e.target.checked })}
              className="accent-foreground size-5"
            />
            Show the name next to the logo
          </label>
        </section>

        {/* Contact & footer */}
        <section
          aria-labelledby="s-contact"
          className="space-y-3 rounded-2xl border p-4"
        >
          <h2 id="s-contact" className="font-semibold">
            Contact &amp; footer
          </h2>
          <p className="text-muted-foreground text-sm">
            Shown at the bottom of every menu page. Leave a field empty to hide
            it.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={address}
              maxLength={200}
              rows={2}
              placeholder="123 Queen St W, Toronto, ON"
              onChange={(e) => setAddress(e.target.value)}
              className="text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              maxLength={40}
              placeholder="+1 416 555 0100"
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="copyright">Copyright holder</Label>
            <Input
              id="copyright"
              value={theme.copyrightHolder}
              maxLength={80}
              placeholder={name || "Name of the place"}
              onChange={(e) => set({ copyrightHolder: e.target.value })}
              className="h-11 text-base"
            />
            <p className="text-muted-foreground text-xs">
              Footer reads “© {new Date().getFullYear()}{" "}
              {theme.copyrightHolder.trim() || name || "…"}. All rights
              reserved.”
            </p>
          </div>
        </section>

        {/* Logo */}
        <section
          aria-labelledby="s-logo"
          className="space-y-3 rounded-2xl border p-4"
        >
          <h2 id="s-logo" className="font-semibold">
            Logo
          </h2>
          <p className="text-muted-foreground text-sm">
            PNG, JPG or WebP. A wide logo on a transparent background looks
            best. It&apos;s resized on your phone before upload.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-muted/50 flex h-16 min-w-16 items-center justify-center rounded-xl border px-3">
              {logoKey ? (
                // eslint-disable-next-line @next/next/no-img-element -- no next/image on Workers
                <img
                  src={imageUrl(logoKey)}
                  alt="Current logo"
                  className="max-h-12 w-auto"
                />
              ) : (
                <span className="text-muted-foreground text-xs">No logo</span>
              )}
            </div>
            <input
              ref={fileRef}
              id="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => void onLogo(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImageUp aria-hidden="true" className="size-4" />
              {uploading
                ? "Uploading…"
                : logoKey
                  ? "Replace logo"
                  : "Upload logo"}
            </Button>
            {logoKey && (
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => {
                  setLogoKey(null);
                  set({ logoWidth: null, logoHeight: null });
                }}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Remove
              </Button>
            )}
          </div>
        </section>

        {/* Colours */}
        <section
          aria-labelledby="s-colours"
          className="space-y-4 rounded-2xl border p-4"
        >
          <h2 id="s-colours" className="font-semibold">
            Colours
          </h2>
          <div
            role="radiogroup"
            aria-label="Palette"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {PRESETS.map((p) => {
              const on = theme.preset === p.preset;
              return (
                <button
                  key={p.preset}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() =>
                    set({
                      preset: p.preset,
                      background: p.background,
                      foreground: p.foreground,
                      accent: p.accent,
                      pattern: p.pattern,
                      panel: p.panel,
                      panelOpacity: p.panelOpacity,
                      card: p.card,
                    })
                  }
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 text-sm",
                    on ? "border-foreground" : "border-border",
                  )}
                >
                  <span className="flex -space-x-1.5" aria-hidden="true">
                    {p.pattern && (
                      <span
                        className="size-5 rounded-full border border-black/15"
                        style={patternSwatch(p.pattern, p.background)}
                      />
                    )}
                    {/* Fixed slots (colours can repeat, e.g. Classic text = accent). */}
                    {[p.background, p.foreground, p.accent].map((c, slot) => (
                      <span
                        key={slot}
                        className="size-5 rounded-full border border-black/15"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  {p.label}
                  {on && (
                    <Check aria-hidden="true" className="ms-auto size-4" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ColourField
              id="bg"
              label="Background"
              value={theme.background}
              onChange={(v) => set({ preset: "custom", background: v })}
            />
            <ColourField
              id="fg"
              label="Text"
              value={theme.foreground}
              onChange={(v) => set({ preset: "custom", foreground: v })}
              invalid={problems.some((p) => p.field === "foreground")}
            />
            <ColourField
              id="ac"
              label="Accent (buttons)"
              value={theme.accent}
              onChange={(v) => set({ preset: "custom", accent: v })}
              invalid={problems.some((p) => p.field === "accent")}
            />
          </div>

          {/* Background pattern */}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">
              Background pattern
            </legend>
            <div
              role="radiogroup"
              aria-label="Background pattern"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {[null, ...PATTERNS.map((x) => x.id)].map((id) => {
                const on = theme.pattern === id;
                const label = id
                  ? PATTERNS.find((x) => x.id === id)!.label
                  : "None";
                return (
                  <button
                    key={id ?? "none"}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`Pattern: ${label}`}
                    onClick={() =>
                      set({
                        preset: "custom",
                        pattern: id,
                        // Over a pattern, panels must be nearly opaque; without one, solid.
                        panelOpacity: id
                          ? Math.max(
                              theme.panelOpacity === 1
                                ? 0.86
                                : theme.panelOpacity,
                              0.75,
                            )
                          : 1,
                      })
                    }
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border-2 p-1.5 text-xs",
                      on ? "border-foreground" : "border-border",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="block h-14 w-full rounded-lg border border-black/10"
                      style={
                        id
                          ? patternSwatch(id, theme.background)
                          : { background: theme.background }
                      }
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Surfaces */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <ColourField
                id="panel"
                label="Section panels"
                value={theme.panel}
                onChange={(v) => set({ preset: "custom", panel: v })}
                invalid={problems.some((p) => p.field === "panel")}
              />
              <div className="space-y-1">
                <Label htmlFor="panel-opacity" className="text-xs">
                  Panel opacity — {Math.round(theme.panelOpacity * 100)}%
                </Label>
                <input
                  id="panel-opacity"
                  type="range"
                  min={theme.pattern ? 75 : 50}
                  max={100}
                  step={1}
                  value={Math.round(theme.panelOpacity * 100)}
                  onChange={(e) =>
                    set({
                      preset: "custom",
                      panelOpacity: Number(e.target.value) / 100,
                    })
                  }
                  className="accent-foreground h-11 w-full"
                />
              </div>
            </div>
            <ColourField
              id="card"
              label="Dish cards"
              value={theme.card}
              onChange={(v) => set({ preset: "custom", card: v })}
              invalid={problems.some((p) => p.field === "card")}
            />
          </div>
          {problems.length > 0 && (
            <ul
              role="alert"
              className="bg-destructive/10 text-destructive space-y-1 rounded-xl p-3 text-sm"
            >
              {problems.map((p) => (
                <li key={p.message} className="flex gap-2">
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  {p.message}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="bg-background/95 sticky bottom-0 -mx-4 border-t px-4 py-3 backdrop-blur">
          <Button
            type="button"
            className="h-12 w-full"
            disabled={
              !dirty ||
              saving ||
              uploading ||
              problems.length > 0 ||
              !name.trim()
            }
            onClick={save}
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "No changes"}
          </Button>
        </div>
      </div>

      {/* Live preview — same CSS variables the public menu uses. */}
      <aside aria-label="Preview" className="lg:sticky lg:top-32 lg:self-start">
        <p className="mb-2 text-sm font-medium">Preview</p>
        {/* Inline vars on the .dark element itself, so shadcn's .dark defaults can't override them. */}
        <div className="overflow-hidden rounded-2xl border shadow-sm">
          <div
            style={vars as React.CSSProperties}
            className={cn(
              "bg-background text-foreground page-pattern pb-1",
              cardsAreDark(theme) && "dark",
            )}
          >
            <div className="surface-chrome flex items-center gap-2 px-4 pt-4 pb-2">
              {logoKey && (
                // eslint-disable-next-line @next/next/no-img-element -- no next/image on Workers
                <img src={imageUrl(logoKey)} alt="" className="h-9 w-auto" />
              )}
              {(theme.showName || !logoKey) && (
                <span className="text-lg font-semibold">{name || "Name"}</span>
              )}
            </div>
            <div className="surface-chrome flex gap-2 border-b px-4 py-2">
              <span className="chip chip-active">Starters</span>
              <span className="chip">Mains</span>
            </div>
            {/* Mirrors the public menu: category panel, raised dish cards, availability dot. */}
            <div className="surface-panel mx-3 my-3 space-y-2.5 rounded-2xl border p-2.5">
              <p className="px-1 text-sm font-semibold">Starters</p>
              <PreviewRow
                dot="bg-emerald-500"
                title="Kashk-e Bademjan"
                price="$12.00"
                badge={
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                    <CircleCheck className="size-3.5" aria-hidden="true" />
                    Available
                  </span>
                }
              />
              <PreviewRow
                dot="bg-amber-400"
                title="Mirza Ghasemi"
                price="$11.00"
                badge={
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <Hourglass className="size-3.5" aria-hidden="true" />
                    Limited
                  </span>
                }
              />
              <PreviewRow
                dimmed
                dot="bg-red-600"
                title="Soup of the Day"
                price="$9.00"
                badge={
                  <span className="bg-muted text-foreground/80 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                    <Ban className="size-3.5" aria-hidden="true" />
                    Sold out today
                  </span>
                }
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function PreviewRow({
  title,
  price,
  badge,
  dimmed,
  dot,
}: {
  title: string;
  price: string;
  badge: React.ReactNode;
  dimmed?: boolean;
  dot: string;
}) {
  return (
    <div className="surface-card flex gap-3 rounded-xl border p-2.5 shadow-md shadow-black/5">
      <div className="relative shrink-0">
        <div
          className={cn("bg-muted size-12 rounded-lg", dimmed && "opacity-50")}
        />
        <span
          aria-hidden="true"
          className={cn(
            "ring-background absolute -start-1 -top-1 size-3 rounded-full ring-2",
            dot,
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2 text-sm">
          <span
            className={cn("font-medium", dimmed && "text-muted-foreground")}
          >
            {title}
          </span>
          <span
            className={cn("font-medium", dimmed && "text-muted-foreground")}
          >
            {price}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">Smoky, rich and fresh.</p>
        <div className="mt-1">{badge}</div>
      </div>
    </div>
  );
}

function ColourField({
  id,
  label,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const [text, setText] = useState(value);
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setText(value);
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
        />
        <Input
          id={id}
          value={text}
          aria-invalid={invalid}
          maxLength={7}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value))
              onChange(e.target.value.toLowerCase());
          }}
          className="h-11 font-mono text-base"
        />
      </div>
    </div>
  );
}

/** Small pattern thumbnail over the theme background (transparent artwork shows the colour). */
function patternSwatch(id: PatternId, background: string): React.CSSProperties {
  const p = PATTERNS.find((x) => x.id === id)!;
  return {
    backgroundColor: background,
    backgroundImage: `url("${p.file}")`,
    backgroundSize: `${Math.round(p.size / 2)}px`,
  };
}
