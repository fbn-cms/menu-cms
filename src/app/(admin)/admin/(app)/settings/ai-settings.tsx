"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  removeAiKey,
  saveAiKey,
  setAiPreferences,
} from "@/lib/actions/ai-settings";
import type { AiProvider, AiSummary } from "@/lib/ai/config";
import { cn } from "@/lib/utils";

type ModelOption = { id: string; label: string };

const PROVIDERS: { id: AiProvider; name: string; hint: string }[] = [
  {
    id: "cloudflare",
    name: "Free Cloudflare AI",
    hint: "No key needed. Good English/French, Persian needs a careful check. ~40 dishes/day.",
  },
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    hint: "Best Persian quality. Paid by your Anthropic account.",
  },
  {
    id: "openai",
    name: "ChatGPT (OpenAI)",
    hint: "Paid by your OpenAI account.",
  },
];

export function AiSettings({
  summary,
  anthropicModels,
  openaiModels,
}: {
  summary: AiSummary;
  anthropicModels: readonly ModelOption[];
  openaiModels: readonly ModelOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [provider, setProvider] = useState<AiProvider>(summary.provider);
  const [models, setModels] = useState({
    anthropic: summary.anthropic.model,
    openai: summary.openai.model,
  });
  const connected = {
    cloudflare: true,
    anthropic: summary.anthropic.connected,
    openai: summary.openai.connected,
  };
  const prefsDirty =
    provider !== summary.provider ||
    models.anthropic !== summary.anthropic.model ||
    models.openai !== summary.openai.model;

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
  ) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (res.message) toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <section
      aria-labelledby="s-ai"
      className="space-y-4 rounded-2xl border p-4"
    >
      <div>
        <h2 id="s-ai" className="font-semibold">
          AI writing &amp; translation
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Used by “Generate” in the dish editor. Add your own Claude or ChatGPT
          key for better quality; without one the free Cloudflare AI is used.
        </p>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Use</legend>
        <div role="radiogroup" aria-label="AI provider" className="grid gap-2">
          {PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3",
                provider === p.id && "border-foreground bg-muted",
                !connected[p.id] && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="ai-provider"
                value={p.id}
                checked={provider === p.id}
                disabled={!connected[p.id]}
                onChange={() => setProvider(p.id)}
                className="accent-foreground mt-0.5 size-5"
              />
              <span>
                <span className="block font-medium">{p.name}</span>
                <span className="text-muted-foreground block text-xs">
                  {connected[p.id] ? p.hint : "Add a key below to use this."}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <ProviderKey
        id="anthropic"
        title="Claude (Anthropic) API key"
        where="console.anthropic.com → Settings → API keys"
        placeholder="sk-ant-…"
        state={summary.anthropic}
        models={anthropicModels}
        model={models.anthropic}
        onModel={(m) => setModels((x) => ({ ...x, anthropic: m }))}
        pending={pending}
        onSave={(key) =>
          run(() =>
            saveAiKey({
              provider: "anthropic",
              apiKey: key,
              model: models.anthropic,
            }),
          )
        }
        onRemove={() => run(() => removeAiKey("anthropic"))}
      />
      <ProviderKey
        id="openai"
        title="ChatGPT (OpenAI) API key"
        where="platform.openai.com → API keys"
        placeholder="sk-…"
        state={summary.openai}
        models={openaiModels}
        model={models.openai}
        onModel={(m) => setModels((x) => ({ ...x, openai: m }))}
        pending={pending}
        onSave={(key) =>
          run(() =>
            saveAiKey({
              provider: "openai",
              apiKey: key,
              model: models.openai,
            }),
          )
        }
        onRemove={() => run(() => removeAiKey("openai"))}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="h-11"
          disabled={!prefsDirty || pending}
          onClick={() =>
            run(() =>
              setAiPreferences({
                provider,
                anthropicModel: models.anthropic,
                openaiModel: models.openai,
              }),
            )
          }
        >
          Save AI choice
        </Button>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Keys are checked with the provider, stored encrypted, and never shown
          again — only their last 4 characters.
        </p>
      </div>
    </section>
  );
}

function ProviderKey({
  id,
  title,
  where,
  placeholder,
  state,
  models,
  model,
  onModel,
  pending,
  onSave,
  onRemove,
}: {
  id: "anthropic" | "openai";
  title: string;
  where: string;
  placeholder: string;
  state: { connected: boolean; hint: string | null };
  models: readonly ModelOption[];
  model: string;
  onModel: (m: string) => void;
  pending: boolean;
  onSave: (key: string) => void;
  onRemove: () => void;
}) {
  const [key, setKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const showInput = !state.connected || replacing;
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <KeyRound aria-hidden="true" className="size-4" />
          {title}
        </p>
        {state.connected && (
          <span
            data-testid={`${id}-status`}
            className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900"
          >
            Connected · ••••{state.hint}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-model`} className="text-xs">
          Model
        </Label>
        <select
          id={`${id}-model`}
          value={model}
          onChange={(e) => onModel(e.target.value)}
          className="bg-background h-11 w-full rounded-md border px-3 text-sm"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      {showInput ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(key);
            setKey("");
            setReplacing(false);
          }}
        >
          <Label htmlFor={`${id}-key`} className="text-xs">
            API key — from {where}
          </Label>
          <Input
            id={`${id}-key`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-11 font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="outline"
              className="h-11"
              disabled={pending || key.trim().length < 20}
            >
              {pending ? "Checking…" : "Check & save key"}
            </Button>
            {replacing && (
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => setReplacing(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : confirmRemove ? (
        <div
          role="alert"
          className="bg-destructive/10 flex flex-wrap items-center gap-2 rounded-lg p-2 text-sm"
        >
          <span>Remove this key? The app will stop using it immediately.</span>
          <Button
            type="button"
            variant="destructive"
            className="h-10"
            disabled={pending}
            onClick={() => {
              onRemove();
              setConfirmRemove(false);
            }}
          >
            Remove key
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            onClick={() => setConfirmRemove(false)}
          >
            Keep it
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => setReplacing(true)}
          >
            Replace key
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-destructive h-10"
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
