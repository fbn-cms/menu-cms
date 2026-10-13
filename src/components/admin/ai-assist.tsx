"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ComposeLang = "en" | "fa" | "fr";
type LangText = {
  name: string;
  short_description: string;
  long_description: string;
  options: string[];
};
export type Composed = Record<ComposeLang, LangText>;

const LANG_NAME: Record<ComposeLang, string> = {
  en: "English",
  fa: "Persian",
  fr: "French",
};

/**
 * "Generate": from the dish as typed in the CURRENT tab's language, the AI writes any missing
 * description in that language and fills the other two (names, descriptions, option names).
 * The result goes into the form for review — nothing is saved until Save.
 */
export function AiCompose({
  source,
  name,
  shortDescription,
  longDescription,
  options,
  category,
  providerLabel,
  onResult,
}: {
  source: ComposeLang;
  name: string;
  shortDescription: string;
  longDescription: string;
  options: string[];
  category: string;
  providerLabel: string;
  onResult: (result: Composed, replaceOthers: boolean) => void;
}) {
  const [notes, setNotes] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const others = (["en", "fa", "fr"] as const)
    .filter((l) => l !== source)
    .map((l) => LANG_NAME[l]);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          name,
          short_description: shortDescription,
          long_description: longDescription,
          notes,
          options,
          category,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        result?: Composed;
        error?: string;
      };
      if (!res.ok || !body.result)
        throw new Error(body.error ?? "AI is unavailable right now.");
      onResult(body.result, replace);
      toast.success(
        `Done — check the ${others.join(" and ")} tabs before saving.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "AI is unavailable right now.",
        { duration: 8000 },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3">
      <Label htmlFor="ai-notes" className="text-sm">
        Notes for the AI (optional) — ingredients, how it’s cooked, how it’s
        served
      </Label>
      <Input
        id="ai-notes"
        dir="auto"
        value={notes}
        maxLength={500}
        placeholder="e.g. charcoal-grilled, saffron rice, grilled tomato"
        onChange={(e) => setNotes(e.target.value)}
        className="h-11 text-base"
      />
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
          className="accent-foreground size-4"
        />
        Replace text already written in {others.join(" and ")}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={busy || !name.trim()}
          onClick={() => void run()}
        >
          <Sparkles aria-hidden="true" className="size-4" />
          {busy ? "Generating…" : `Generate from ${LANG_NAME[source]}`}
        </Button>
        <p className="text-muted-foreground text-xs">
          Writes missing descriptions and fills {others.join(" & ")}. Using{" "}
          {providerLabel}. Check allergens yourself.
        </p>
      </div>
    </div>
  );
}
