"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { TagIcon } from "@/components/menu/tag-icon";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { TranslationStatus } from "@/components/admin/language-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deleteTag, saveTag } from "@/lib/actions/cms";
import { ICON_NAMES, suggestIcon, type IconName } from "@/lib/cms/icons";
import { cn } from "@/lib/utils";

type Kind = "dietary" | "feature" | "allergen";
export type TagRow = {
  id: string;
  label: string;
  kind: Kind;
  icon: string | null;
  uses: number;
  translations: { fa: string; fr: string };
};

const GROUPS: { kind: Kind; title: string; hint: string }[] = [
  {
    kind: "dietary",
    title: "Dietary",
    hint: "Vegan, halal, gluten-free… Guests can filter the menu by these.",
  },
  { kind: "allergen", title: "Allergens", hint: "Listed on each dish page." },
  { kind: "feature", title: "Highlights", hint: "Chef’s pick, new, spicy…" },
];

export function TagManager({ rows }: { rows: TagRow[] }) {
  const [editing, setEditing] = useState<TagRow | null>(null);
  const blank = (kind: Kind): TagRow => ({
    id: crypto.randomUUID(),
    label: "",
    kind,
    icon: null,
    uses: 0,
    translations: { fa: "", fr: "" },
  });

  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.kind === g.kind);
        return (
          <section
            key={g.kind}
            aria-labelledby={`g-${g.kind}`}
            className="space-y-2"
          >
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 id={`g-${g.kind}`} className="font-semibold">
                  {g.title}
                </h2>
                <p className="text-muted-foreground text-xs">{g.hint}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setEditing(blank(g.kind))}
              >
                <Plus aria-hidden="true" className="size-4" />
                Add
              </Button>
            </div>
            <ul className="divide-y rounded-2xl border">
              {list.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-3">
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <TagIcon name={t.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.label}</p>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                      <TranslationStatus
                        has={{
                          fa: !!t.translations.fa,
                          fr: !!t.translations.fr,
                        }}
                      />
                      <span>
                        {t.uses === 0
                          ? "Not used"
                          : `${t.uses} ${t.uses === 1 ? "dish" : "dishes"}`}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    aria-label={`Edit ${t.label}`}
                    onClick={() => setEditing(t)}
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </Button>
                </li>
              ))}
              {!list.length && (
                <li className="text-muted-foreground p-3 text-sm">None yet.</li>
              )}
            </ul>
          </section>
        );
      })}
      {editing && (
        <TagEditor
          key={editing.id}
          initial={editing}
          isNew={!rows.some((r) => r.id === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TagEditor({
  initial,
  isNew,
  onClose,
}: {
  initial: TagRow;
  isNew: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  // Auto-suggest the icon from the label until the person picks one themselves.
  const [iconPicked, setIconPicked] = useState(!isNew && !!initial.icon);
  const [saving, start] = useTransition();
  const suggestion =
    suggestIcon(v.label) ??
    suggestIcon(v.translations.fr) ??
    suggestIcon(v.translations.fa);
  const icon = iconPicked ? v.icon : (suggestion ?? v.icon);

  const save = () =>
    start(async () => {
      const res = await saveTag({
        id: v.id,
        label: v.label,
        kind: v.kind,
        icon,
        translations: v.translations,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(isNew ? "Label added." : "Saved.");
      onClose();
      router.refresh();
    });

  return (
    <Sheet open onOpenChange={(open) => !open && !saving && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>
            {isNew ? "New label" : `Edit “${initial.label}”`}
          </SheetTitle>
          <SheetDescription>
            Shown on dishes and, for dietary labels, as menu filters.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Group</legend>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <label
                  key={g.kind}
                  className="has-[:checked]:border-foreground has-[:checked]:bg-muted flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3"
                >
                  <input
                    type="radio"
                    name="kind"
                    checked={v.kind === g.kind}
                    onChange={() => setV({ ...v, kind: g.kind })}
                    className="accent-foreground size-4"
                  />
                  {g.title}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="tag-en">English (required)</Label>
              <Input
                id="tag-en"
                value={v.label}
                maxLength={40}
                onChange={(e) => setV({ ...v, label: e.target.value })}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-fa">Persian</Label>
              <Input
                id="tag-fa"
                dir="rtl"
                lang="fa"
                value={v.translations.fa}
                maxLength={40}
                onChange={(e) =>
                  setV({
                    ...v,
                    translations: { ...v.translations, fa: e.target.value },
                  })
                }
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-fr">French</Label>
              <Input
                id="tag-fr"
                lang="fr"
                value={v.translations.fr}
                maxLength={40}
                onChange={(e) =>
                  setV({
                    ...v,
                    translations: { ...v.translations, fr: e.target.value },
                  })
                }
                className="h-11 text-base"
              />
            </div>
          </div>
          <fieldset>
            <legend className="mb-1.5 flex items-center gap-2 text-sm font-medium">
              Icon
              {!iconPicked && suggestion && (
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-normal">
                  <Wand2 aria-hidden="true" className="size-3.5" />
                  suggested from the label
                </span>
              )}
            </legend>
            <div
              role="radiogroup"
              aria-label="Icon"
              className="grid grid-cols-8 gap-1.5 sm:grid-cols-12"
            >
              {ICON_NAMES.map((name: IconName) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={icon === name}
                  aria-label={name.replace(/-/g, " ")}
                  title={name.replace(/-/g, " ")}
                  onClick={() => {
                    setIconPicked(true);
                    setV({ ...v, icon: name });
                  }}
                  className={cn(
                    "flex aspect-square min-h-10 items-center justify-center rounded-lg border",
                    icon === name
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-muted",
                  )}
                >
                  <TagIcon name={name} className="size-5" />
                </button>
              ))}
            </div>
            {iconPicked && suggestion && suggestion !== icon && (
              <button
                type="button"
                className="mt-2 min-h-11 text-sm underline underline-offset-4"
                onClick={() => setIconPicked(false)}
              >
                Use the suggested icon instead
              </button>
            )}
          </fieldset>
          {!isNew && (
            <ConfirmDelete
              what="label"
              name={initial.label}
              detail={
                initial.uses
                  ? `It will be removed from ${initial.uses} ${initial.uses === 1 ? "dish" : "dishes"}. This can't be undone.`
                  : undefined
              }
              onConfirm={async () => {
                const res = await deleteTag(initial.id);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Label deleted.");
                onClose();
                router.refresh();
              }}
            />
          )}
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-12 flex-1"
            disabled={saving || !v.label.trim()}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
