"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import {
  inputDir,
  LanguageTabs,
  type EditLocale,
} from "@/components/admin/language-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteCategory,
  saveCategory,
  type CategoryInput,
} from "@/lib/actions/cms";
import { slugify } from "@/lib/cms/text";

export type CategoryFormValue = Omit<CategoryInput, "translations"> & {
  description: string;
  translations: Record<"fa" | "fr", { name: string; description: string }>;
};

export function CategoryForm({
  initial,
  isNew,
  itemCount,
}: {
  initial: CategoryFormValue;
  isNew: boolean;
  itemCount: number;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [lang, setLang] = useState<EditLocale>("en");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saving, start] = useTransition();

  const text =
    lang === "en"
      ? { name: v.name, description: v.description }
      : v.translations[lang];
  const setText = (patch: Partial<{ name: string; description: string }>) =>
    setV((cur) => {
      if (lang === "en") {
        const name = patch.name ?? cur.name;
        return {
          ...cur,
          ...patch,
          slug: slugTouched ? cur.slug : slugify(name),
        };
      }
      return {
        ...cur,
        translations: {
          ...cur.translations,
          [lang]: { ...cur.translations[lang], ...patch },
        },
      };
    });

  const save = () =>
    start(async () => {
      const res = await saveCategory(v);
      if (!res.ok) return void toast.error(res.error);
      toast.success(isNew ? "Category created." : "Saved.");
      router.push("/admin/categories");
      router.refresh();
    });

  return (
    <div className="space-y-5 pb-24">
      <Link
        href="/admin/categories"
        className="inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Categories
      </Link>
      <h1 className="text-lg font-semibold">
        {isNew ? "New category" : v.name || "Category"}
      </h1>

      <section className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Name &amp; description</h2>
          <LanguageTabs
            value={lang}
            onChange={setLang}
            missing={{
              en: !v.name.trim(),
              fa: !v.translations.fa.name.trim(),
              fr: !v.translations.fr.name.trim(),
            }}
          />
        </div>
        {lang !== "en" && (
          <p className="text-muted-foreground text-xs">
            Leave empty to show the English text: “{v.name || "…"}”.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cat-name">Name{lang === "en" && " (required)"}</Label>
          <Input
            id="cat-name"
            dir={inputDir(lang)}
            lang={lang}
            value={text.name}
            maxLength={80}
            placeholder={lang === "en" ? "Starters" : v.name}
            onChange={(e) => setText({ name: e.target.value })}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat-desc">Short description (optional)</Label>
          <Textarea
            id="cat-desc"
            dir={inputDir(lang)}
            lang={lang}
            rows={2}
            maxLength={500}
            value={text.description}
            onChange={(e) => setText({ description: e.target.value })}
            className="text-base"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <h2 className="font-semibold">Settings</h2>
        <div className="space-y-1.5">
          <Label htmlFor="cat-slug">Web address</Label>
          <div className="text-muted-foreground flex items-center gap-1 text-sm">
            <span>/menu/</span>
            <Input
              id="cat-slug"
              value={v.slug}
              maxLength={80}
              onChange={(e) => {
                setSlugTouched(true);
                setV({
                  ...v,
                  slug: slugify(e.target.value) || e.target.value.toLowerCase(),
                });
              }}
              className="h-11 font-mono text-base"
            />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={v.isPublished}
            onChange={(e) => setV({ ...v, isPublished: e.target.checked })}
            className="accent-foreground size-5"
          />
          Show this category on the menu
        </label>
      </section>

      {!isNew && (
        <ConfirmDelete
          what="category"
          name={v.name}
          disabled={itemCount > 0}
          detail="The category and its translations will be removed. This can't be undone."
          onConfirm={async () => {
            const res = await deleteCategory(v.id);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Category deleted.");
            router.push("/admin/categories");
            router.refresh();
          }}
        />
      )}
      {!isNew && itemCount > 0 && (
        <p className="text-muted-foreground text-xs">
          To delete it, first move or delete its {itemCount} dishes.
        </p>
      )}

      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button
            type="button"
            className="h-12 w-full"
            disabled={saving || !v.name.trim() || !v.slug}
            onClick={save}
          >
            {saving ? "Saving…" : isNew ? "Create category" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
