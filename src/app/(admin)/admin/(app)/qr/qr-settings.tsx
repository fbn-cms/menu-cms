"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQrCode, saveQrCode } from "@/lib/actions/qr";

export function QrSettings(props: {
  id: string;
  label: string;
  targetPath: string;
  isActive: boolean;
  categories: { name: string; slug: string }[];
}) {
  const [label, setLabel] = useState(props.label);
  const [targetPath, setTargetPath] = useState(props.targetPath);
  const [isActive, setIsActive] = useState(props.isActive);
  const [pending, start] = useTransition();
  const known =
    targetPath === "/" ||
    props.categories.some((c) => `/menu/${c.slug}` === targetPath);

  return (
    <form
      aria-labelledby="qr-settings"
      className="space-y-4 rounded-2xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveQrCode({
            id: props.id,
            label,
            targetPath,
            isActive,
          });
          if (res.ok) toast.success("Saved. Printed codes follow right away.");
          else toast.error(res.error);
        });
      }}
    >
      <div>
        <h2 id="qr-settings" className="font-semibold">
          Settings
        </h2>
        <p className="text-muted-foreground text-sm">
          The printed code never changes. These settings decide what it does, so
          you can change them any time without reprinting.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="qr-label">Name (only you see it)</Label>
          <Input
            id="qr-label"
            className="h-11"
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qr-target">Opens</Label>
          <select
            id="qr-target"
            value={targetPath}
            onChange={(e) => setTargetPath(e.target.value)}
            className="bg-background h-11 w-full rounded-md border px-3 text-base"
          >
            <option value="/">Full menu</option>
            {props.categories.map((c) => (
              <option key={c.slug} value={`/menu/${c.slug}`}>
                Section: {c.name}
              </option>
            ))}
            {!known && <option value={targetPath}>{targetPath}</option>}
          </select>
        </div>
      </div>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span>
          <span className="font-medium">Count scans</span>
          <span className="text-muted-foreground block">
            When off, the code still opens the full menu but scans are not
            recorded.
          </span>
        </span>
      </label>
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function CreateQrButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      className="h-11"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createQrCode();
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? "Creating…" : "Create QR code"}
    </Button>
  );
}
