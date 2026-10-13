"use client";

import { useState } from "react";
import { Languages, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Described = { short_description: string; long_description: string };
type TrText = {
  name: string;
  short_description: string;
  long_description: string;
  options: string[];
};
export type Translated = { fa: TrText; fr: TrText };

async function callAi<T>(payload: object): Promise<T> {
  const res = await fetch("/api/admin/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "AI is unavailable right now.");
  return body;
}

/** "Write with AI": English short + long description from the name, category and the cook's notes. */
export function AiDescribe({
  name,
  category,
  options,
  hasText,
  onResult,
}: {
  name: string;
  category: string;
  options: string[];
  hasText: boolean;
  onResult: (d: Described) => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      onResult(
        await callAi<Described>({
          task: "describe",
          name,
          category,
          notes,
          options,
        }),
      );
      toast.success(
        "Suggestion added below — edit it as you like before saving.",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "AI is unavailable right now.",
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
        value={notes}
        maxLength={500}
        placeholder="e.g. charcoal-grilled, saffron rice, grilled tomato"
        onChange={(e) => setNotes(e.target.value)}
        className="h-11 text-base"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={busy || !name.trim()}
          onClick={() => void run()}
        >
          <Sparkles aria-hidden="true" className="size-4" />
          {busy ? "Writing…" : hasText ? "Rewrite with AI" : "Write with AI"}
        </Button>
        <p className="text-muted-foreground text-xs">
          Uses only what you tell it — check allergens yourself.
        </p>
      </div>
    </div>
  );
}

/** "Translate": fills Persian + French from the English text, for a person to check. */
export function AiTranslate({
  source,
  onResult,
  disabled,
}: {
  source: {
    name: string;
    short_description: string;
    long_description: string;
    options: string[];
  };
  onResult: (t: Translated) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      onResult(await callAi<Translated>({ task: "translate", ...source }));
      toast.success(
        "Persian and French filled in — please check them before saving.",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "AI is unavailable right now.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11"
      disabled={busy || disabled || !source.name.trim()}
      onClick={() => void run()}
    >
      <Languages aria-hidden="true" className="size-4" />
      {busy ? "Translating…" : "Translate to Persian & French"}
    </Button>
  );
}
