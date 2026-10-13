"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ExternalLink, Flame, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AiDescribe,
  AiTranslate,
  type Translated,
} from "@/components/admin/ai-assist";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { ImageField } from "@/components/admin/image-field";
import {
  inputDir,
  LanguageTabs,
  type EditLocale,
} from "@/components/admin/language-tabs";
import { TagIcon } from "@/components/menu/tag-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteItem, saveItem, type ItemInput } from "@/lib/actions/cms";
import { centsToInput, parsePriceToCents, slugify } from "@/lib/cms/text";
import { cn } from "@/lib/utils";

type Tr = { name: string; short_description: string; long_description: string };
type Variant = {
  id: string | null;
  name: string;
  priceCents: number;
  availability: "available" | "limited" | "unavailable";
  translations: { fa: string; fr: string };
};
export type ItemFormValue = Omit<
  ItemInput,
  "translations" | "variants" | "shortDescription" | "longDescription"
> & {
  shortDescription: string;
  longDescription: string;
  translations: { fa: Tr; fr: Tr };
  variants: Variant[];
};
type Tag = {
  id: string;
  label: string;
  kind: "dietary" | "feature" | "allergen";
  icon: string | null;
};

const TAG_GROUPS = [
  { kind: "dietary", title: "Dietary" },
  { kind: "allergen", title: "Allergens" },
  { kind: "feature", title: "Highlights" },
] as const;
const SPICE = ["None", "Mild", "Medium", "Hot"];

export function ItemForm({
  initial,
  isNew,
  categories,
  tags,
  currency,
}: {
  initial: ItemFormValue;
  isNew: boolean;
  categories: { id: string; name: string }[];
  tags: Tag[];
  currency: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [lang, setLang] = useState<EditLocale>("en");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [priceText, setPriceText] = useState(
    isNew ? "" : centsToInput(initial.priceCents),
  );
  const [variantPrices, setVariantPrices] = useState(
    initial.variants.map((x) => centsToInput(x.priceCents)),
  );
  const [saving, start] = useTransition();
  // Languages last filled by machine translation and not yet reviewed (UI only, never saved).
  const [machine, setMachine] = useState<{ fa: boolean; fr: boolean }>({
    fa: false,
    fr: false,
  });
  const set = (patch: Partial<ItemFormValue>) =>
    setV((cur) => ({ ...cur, ...patch }));

  const dirty = useMemo(
    () => JSON.stringify(v) !== JSON.stringify(saved),
    [v, saved],
  );
  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ---------------------------------------------------------------- text per language
  const text: Tr =
    lang === "en"
      ? {
          name: v.name,
          short_description: v.shortDescription,
          long_description: v.longDescription,
        }
      : v.translations[lang];
  const setText = (patch: Partial<Tr>) =>
    setV((cur) => {
      if (lang === "en") {
        const name = patch.name ?? cur.name;
        return {
          ...cur,
          name,
          shortDescription: patch.short_description ?? cur.shortDescription,
          longDescription: patch.long_description ?? cur.longDescription,
          slug: slugTouched ? cur.slug : slugify(name),
        };
      }
      setMachine((m) => ({ ...m, [lang]: false })); // edited by a person → reviewed
      return {
        ...cur,
        translations: {
          ...cur.translations,
          [lang]: { ...cur.translations[lang], ...patch },
        },
      };
    });

  const applyTranslation = (t: Translated) => {
    setV((cur) => ({
      ...cur,
      translations: {
        fa: {
          name: t.fa.name,
          short_description: t.fa.short_description,
          long_description: t.fa.long_description,
        },
        fr: {
          name: t.fr.name,
          short_description: t.fr.short_description,
          long_description: t.fr.long_description,
        },
      },
      variants: cur.variants.map((x, i) => ({
        ...x,
        translations: {
          fa: t.fa.options[i] ?? x.translations.fa,
          fr: t.fr.options[i] ?? x.translations.fr,
        },
      })),
    }));
    setMachine({ fa: true, fr: true });
    setLang("fa");
  };
  const missing = {
    en: !v.name.trim(),
    fa:
      !v.translations.fa.name.trim() ||
      (!!v.shortDescription && !v.translations.fa.short_description.trim()),
    fr:
      !v.translations.fr.name.trim() ||
      (!!v.shortDescription && !v.translations.fr.short_description.trim()),
  };

  // ---------------------------------------------------------------- price & options
  const priceInvalid =
    priceText !== "" && parsePriceToCents(priceText) === null;
  const variantInvalid = variantPrices.some(
    (p) => parsePriceToCents(p) === null,
  );
  const updateVariant = (i: number, patch: Partial<Variant>) =>
    set({
      variants: v.variants.map((x, k) => (k === i ? { ...x, ...patch } : x)),
    });

  const toggleTag = (id: string) =>
    set({
      tagIds: v.tagIds.includes(id)
        ? v.tagIds.filter((t) => t !== id)
        : [...v.tagIds, id],
    });

  const canSave =
    !!v.name.trim() &&
    !!v.slug &&
    priceText !== "" &&
    !priceInvalid &&
    !variantInvalid &&
    v.variants.every((x) => x.name.trim());

  const save = () =>
    start(async () => {
      const res = await saveItem(v);
      if (!res.ok) {
        toast.error(res.error, { duration: res.conflict ? 10_000 : 5_000 });
        return;
      }
      const next = { ...v, expectedUpdatedAt: res.updatedAt ?? null };
      setV(next);
      setSaved(next);
      toast.success(
        isNew
          ? "Dish created — it's on the menu."
          : "Saved — the menu is updated.",
      );
      if (isNew) router.replace(`/admin/items/${v.id}`);
      router.refresh();
    });

  return (
    <div className="space-y-5 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/admin/items"
          className="inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Dishes
        </Link>
        {!isNew && v.isPublished && (
          <a
            href={`/en/item/${saved.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
          >
            View on menu
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        )}
      </div>
      <h1 className="text-lg font-semibold">
        {isNew ? "New dish" : v.name || "Dish"}
      </h1>

      {/* Photos */}
      <section
        aria-labelledby="s-photos"
        className="space-y-3 rounded-2xl border p-4"
      >
        <h2 id="s-photos" className="font-semibold">
          Photos
        </h2>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <ImageField
            kind="icon"
            itemId={v.id}
            label="Menu thumbnail"
            value={{ key: v.iconKey, lqip: v.iconLqip }}
            onChange={(x) => set({ iconKey: x.key, iconLqip: x.lqip })}
          />
          <ImageField
            kind="hero"
            itemId={v.id}
            label="Dish page photo"
            value={{ key: v.heroKey, lqip: v.heroLqip }}
            onChange={(x) => set({ heroKey: x.key, heroLqip: x.lqip })}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Photos are cropped and compressed on your device, then uploaded.
          Replacing a photo removes the old one overnight.
        </p>
      </section>

      {/* Text */}
      <section
        aria-labelledby="s-text"
        className="space-y-3 rounded-2xl border p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="s-text" className="font-semibold">
            Name &amp; description
          </h2>
          <LanguageTabs value={lang} onChange={setLang} missing={missing} />
        </div>
        {lang === "en" ? (
          <AiDescribe
            name={v.name}
            category={categories.find((c) => c.id === v.categoryId)?.name ?? ""}
            options={v.variants.map((x) => x.name).filter(Boolean)}
            hasText={!!(v.shortDescription || v.longDescription)}
            onResult={(d) =>
              setV((cur) => ({
                ...cur,
                shortDescription: d.short_description,
                longDescription: d.long_description,
              }))
            }
          />
        ) : (
          <p className="text-muted-foreground text-xs">
            Empty fields show the English text to guests.
          </p>
        )}
        {lang !== "en" && machine[lang] && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950"
          >
            <span>
              Machine-translated — please read it through before saving.
            </span>
            <button
              type="button"
              className="min-h-11 font-medium underline underline-offset-4"
              onClick={() => setMachine((m) => ({ ...m, [lang]: false }))}
            >
              Looks good
            </button>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="name">Name{lang === "en" && " (required)"}</Label>
          <Input
            id="name"
            dir={inputDir(lang)}
            lang={lang}
            value={text.name}
            maxLength={120}
            placeholder={lang === "en" ? "Koobideh Kebab" : v.name}
            onChange={(e) => setText({ name: e.target.value })}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="short">Short description — on the menu list</Label>
          <Textarea
            id="short"
            dir={inputDir(lang)}
            lang={lang}
            rows={2}
            maxLength={200}
            value={text.short_description}
            placeholder={lang === "en" ? "" : v.shortDescription}
            onChange={(e) => setText({ short_description: e.target.value })}
            className="text-base"
          />
          <p className="text-muted-foreground text-end text-xs">
            {text.short_description.length}/200
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="long">Full description — on the dish page</Label>
          <Textarea
            id="long"
            dir={inputDir(lang)}
            lang={lang}
            rows={5}
            maxLength={4000}
            value={text.long_description}
            placeholder={lang === "en" ? "" : v.longDescription}
            onChange={(e) => setText({ long_description: e.target.value })}
            className="text-base"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <AiTranslate
            disabled={!v.shortDescription && !v.longDescription && !v.name}
            source={{
              name: v.name,
              short_description: v.shortDescription,
              long_description: v.longDescription,
              options: v.variants.map((x) => x.name),
            }}
            onResult={applyTranslation}
          />
          <p className="text-muted-foreground text-xs">
            Fills the FA and FR tabs (and option names) from the English.
            Nothing is saved until you press Save.
          </p>
        </div>
      </section>

      {/* Price & details */}
      <section
        aria-labelledby="s-details"
        className="space-y-4 rounded-2xl border p-4"
      >
        <h2 id="s-details" className="font-semibold">
          Price &amp; details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={v.categoryId}
              onChange={(e) => set({ categoryId: e.target.value })}
              className="bg-background h-11 w-full rounded-md border px-3 text-base"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Price ({currency}) (required)</Label>
            <Input
              id="price"
              inputMode="decimal"
              value={priceText}
              placeholder="0.00"
              aria-invalid={priceInvalid}
              onChange={(e) => {
                setPriceText(e.target.value);
                const c = parsePriceToCents(e.target.value);
                if (c !== null) set({ priceCents: c });
              }}
              className="h-11 text-base tabular-nums"
            />
            {priceInvalid && (
              <p className="text-destructive text-xs">
                Enter a price like 12 or 12.50.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prep">Prep time (minutes, optional)</Label>
            <Input
              id="prep"
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              value={v.prepMinutes ?? ""}
              onChange={(e) =>
                set({
                  prepMinutes:
                    e.target.value === ""
                      ? null
                      : Math.min(
                          600,
                          Math.max(0, Math.floor(Number(e.target.value))),
                        ),
                })
              }
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cal">Calories (optional)</Label>
            <Input
              id="cal"
              type="number"
              inputMode="numeric"
              min={0}
              max={10000}
              value={v.calories ?? ""}
              onChange={(e) =>
                set({
                  calories:
                    e.target.value === ""
                      ? null
                      : Math.min(
                          10000,
                          Math.max(0, Math.floor(Number(e.target.value))),
                        ),
                })
              }
              className="h-11 text-base"
            />
          </div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Spice level</legend>
          <div
            role="radiogroup"
            aria-label="Spice level"
            className="grid grid-cols-4 gap-2"
          >
            {SPICE.map((label, level) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={v.spiceLevel === level}
                onClick={() => set({ spiceLevel: level })}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-xl border text-xs",
                  v.spiceLevel === level
                    ? "border-foreground bg-muted font-medium"
                    : "",
                )}
              >
                <span className="flex text-orange-700" aria-hidden="true">
                  {level === 0
                    ? "—"
                    : Array.from({ length: level }, (_, i) => (
                        <Flame key={i} className="size-3.5" />
                      ))}
                </span>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {/* Sizes & options */}
      <section
        aria-labelledby="s-variants"
        className="space-y-3 rounded-2xl border p-4"
      >
        <div>
          <h2 id="s-variants" className="font-semibold">
            Sizes &amp; options
          </h2>
          <p className="text-muted-foreground text-xs">
            Optional, e.g. “Small / Large” or “Half tray / Full tray”, each with
            its own price.
          </p>
        </div>
        {v.variants.map((x, i) => (
          <div
            key={x.id ?? `new-${i}`}
            className="space-y-2 rounded-xl border p-2"
          >
            <div className="grid grid-cols-[1fr_6.5rem_auto] items-end gap-2 sm:grid-cols-[1fr_7rem_9rem_auto]">
              <div className="space-y-1">
                <Label htmlFor={`vn-${i}`} className="text-xs">
                  Option name
                </Label>
                <Input
                  id={`vn-${i}`}
                  value={x.name}
                  maxLength={80}
                  onChange={(e) => updateVariant(i, { name: e.target.value })}
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`vp-${i}`} className="text-xs">
                  Price
                </Label>
                <Input
                  id={`vp-${i}`}
                  inputMode="decimal"
                  value={variantPrices[i] ?? ""}
                  aria-invalid={
                    parsePriceToCents(variantPrices[i] ?? "") === null
                  }
                  onChange={(e) => {
                    setVariantPrices((ps) =>
                      ps.map((p, k) => (k === i ? e.target.value : p)),
                    );
                    const c = parsePriceToCents(e.target.value);
                    if (c !== null) updateVariant(i, { priceCents: c });
                  }}
                  className="h-11 text-base tabular-nums"
                />
              </div>
              <div className="hidden space-y-1 sm:block">
                <Label htmlFor={`va-${i}`} className="text-xs">
                  Availability
                </Label>
                <select
                  id={`va-${i}`}
                  value={x.availability}
                  onChange={(e) =>
                    updateVariant(i, {
                      availability: e.target.value as Variant["availability"],
                    })
                  }
                  className="bg-background h-11 w-full rounded-md border px-2 text-sm"
                >
                  <option value="available">Available</option>
                  <option value="limited">Limited</option>
                  <option value="unavailable">Sold out</option>
                </select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Remove option ${x.name || i + 1}`}
                onClick={() => {
                  set({ variants: v.variants.filter((_, k) => k !== i) });
                  setVariantPrices((ps) => ps.filter((_, k) => k !== i));
                }}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </div>
            {/* Option name in the other languages (empty → English is shown) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label
                  htmlFor={`vfa-${i}`}
                  className="text-muted-foreground text-xs"
                >
                  Persian name
                </Label>
                <Input
                  id={`vfa-${i}`}
                  dir="rtl"
                  lang="fa"
                  value={x.translations.fa}
                  maxLength={80}
                  placeholder={x.name}
                  onChange={(e) =>
                    updateVariant(i, {
                      translations: { ...x.translations, fa: e.target.value },
                    })
                  }
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor={`vfr-${i}`}
                  className="text-muted-foreground text-xs"
                >
                  French name
                </Label>
                <Input
                  id={`vfr-${i}`}
                  lang="fr"
                  value={x.translations.fr}
                  maxLength={80}
                  placeholder={x.name}
                  onChange={(e) =>
                    updateVariant(i, {
                      translations: { ...x.translations, fr: e.target.value },
                    })
                  }
                  className="h-10 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={v.variants.length >= 20}
          onClick={() => {
            set({
              variants: [
                ...v.variants,
                {
                  id: null,
                  name: "",
                  priceCents: v.priceCents,
                  availability: "available",
                  translations: { fa: "", fr: "" },
                },
              ],
            });
            setVariantPrices((ps) => [...ps, centsToInput(v.priceCents)]);
          }}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add size or option
        </Button>
      </section>

      {/* Labels */}
      <section
        aria-labelledby="s-tags"
        className="space-y-3 rounded-2xl border p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="s-tags" className="font-semibold">
            Labels &amp; allergens
          </h2>
          <Link
            href="/admin/tags"
            className="min-h-11 content-center text-sm underline underline-offset-4"
          >
            Manage labels
          </Link>
        </div>
        {TAG_GROUPS.map((g) => {
          const list = tags.filter((t) => t.kind === g.kind);
          if (!list.length) return null;
          return (
            <fieldset key={g.kind}>
              <legend className="mb-1.5 text-sm font-medium">{g.title}</legend>
              <div className="flex flex-wrap gap-2">
                {list.map((t) => {
                  const on = v.tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(t.id)}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "hover:bg-muted",
                      )}
                    >
                      <TagIcon name={t.icon} className="size-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </section>

      {/* Visibility */}
      <section
        aria-labelledby="s-vis"
        className="space-y-2 rounded-2xl border p-4"
      >
        <h2 id="s-vis" className="font-semibold">
          Visibility
        </h2>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={v.isPublished}
            onChange={(e) => set({ isPublished: e.target.checked })}
            className="accent-foreground size-5"
          />
          Show this dish on the menu
        </label>
        <p className="text-muted-foreground ps-8 text-xs">
          Unticked = hidden completely (e.g. seasonal). To mark it sold out — or
          as today’s Chef’s pick — use the{" "}
          <Link
            href="/admin/availability"
            className="underline underline-offset-4"
          >
            86 board
          </Link>
          .
        </p>
        <div className="space-y-1.5 pt-2">
          <Label htmlFor="slug">Web address</Label>
          <div className="text-muted-foreground flex items-center gap-1 text-sm">
            <span>/item/</span>
            <Input
              id="slug"
              value={v.slug}
              maxLength={80}
              onChange={(e) => {
                setSlugTouched(true);
                set({
                  slug: slugify(e.target.value) || e.target.value.toLowerCase(),
                });
              }}
              className="h-11 font-mono text-base"
            />
          </div>
          {!isNew && v.slug !== saved.slug && (
            <p className="text-xs text-amber-800">
              Changing the web address breaks links people may have shared.
            </p>
          )}
        </div>
      </section>

      {!isNew && (
        <ConfirmDelete
          what="dish"
          name={v.name}
          detail="The dish, its translations and photos will be removed from the menu. This can't be undone — to hide it temporarily, untick “Show this dish on the menu” instead."
          onConfirm={async () => {
            const res = await deleteItem(v.id);
            if (!res.ok) return void toast.error(res.error);
            setSaved(v); // nothing left to warn about
            toast.success("Dish deleted.");
            router.push("/admin/items");
            router.refresh();
          }}
        />
      )}

      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p
            className="text-muted-foreground hidden flex-1 text-sm sm:block"
            aria-live="polite"
          >
            {dirty ? "Unsaved changes" : isNew ? "" : "All changes saved"}
          </p>
          <Button
            type="button"
            className="h-12 flex-1 sm:flex-none sm:px-8"
            disabled={saving || !canSave || (!dirty && !isNew)}
            onClick={save}
          >
            {saving ? "Saving…" : isNew ? "Create dish" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
