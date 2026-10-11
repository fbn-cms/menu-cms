"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, Hourglass, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import type { UntilPreset } from "@/lib/availability/until";
import {
  resetAllAvailability,
  setAvailability,
  type BoardRow,
} from "@/lib/actions/availability";
import { cn } from "@/lib/utils";

type State = BoardRow["availability"];
type Item = BoardRow & { name: string };
export type BoardCategory = { id: string; name: string; items: Item[] };

const STATES: {
  value: State;
  label: string;
  icon: typeof CircleCheck;
  on: string;
}[] = [
  {
    value: "available",
    label: "Available",
    icon: CircleCheck,
    on: "bg-emerald-600 text-white border-emerald-600",
  },
  {
    value: "limited",
    label: "Limited",
    icon: Hourglass,
    on: "bg-amber-400 text-amber-950 border-amber-400",
  },
  {
    value: "unavailable",
    label: "Sold out",
    icon: Ban,
    on: "bg-neutral-900 text-white border-neutral-900",
  },
];

const UNTIL: { value: UntilPreset; label: string }[] = [
  { value: "service", label: "Rest of service" },
  { value: "tonight", label: "Tonight (back at 4 am)" },
  { value: "manual", label: "Until I change it" },
];

export function Board({
  categories,
  canReset,
  timezone,
}: {
  categories: BoardCategory[];
  canReset: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(
    () =>
      new Map(
        categories.flatMap((c) => c.items.map((i) => [i.id, i] as const)),
      ),
  );
  const [query, setQuery] = useState("");
  // `until` = what the sheet pre-selects; must match what was actually saved.
  const [editing, setEditing] = useState<{
    id: string;
    state: State;
    until: UntilPreset;
  } | null>(null);

  // Fresh server data (e.g. after router.refresh) replaces local state.
  const [base, setBase] = useState(categories);
  if (base !== categories) {
    setBase(categories);
    setRows(
      new Map(
        categories.flatMap((c) => c.items.map((i) => [i.id, i] as const)),
      ),
    );
  }
  // Another phone may have changed things while this one was in a pocket.
  useEffect(() => {
    const onVisible = () =>
      document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const save = async (
    id: string,
    patch: {
      availability: State;
      note?: string | null;
      remainingQty?: number | null;
      until?: UntilPreset;
    },
  ) => {
    const before = rows.get(id);
    if (!before) return;
    // Optimistic: show the new state instantly.
    setRows((m) =>
      new Map(m).set(id, { ...before, availability: patch.availability }),
    );
    const res = await setAvailability({
      itemId: id,
      expectedUpdatedAt: before.updated_at,
      ...patch,
    });
    if (res.ok) {
      setRows((m) => new Map(m).set(id, { ...before, ...res.row }));
    } else {
      setRows((m) =>
        new Map(m).set(id, res.row ? { ...before, ...res.row } : before),
      );
      toast.error(
        res.conflict
          ? `${before.name}: ${res.error} Showing the latest.`
          : res.error,
      );
    }
    return res.ok;
  };

  const onTap = (item: Item, state: State) => {
    if (state === item.availability && state === "available") return;
    // Open the optional-details sheet straight away, but close it if the save is refused
    // (e.g. someone else changed the dish) so the refreshed row is visible.
    if (state !== "available")
      setEditing({ id: item.id, state, until: "tonight" }); // same as the save below
    void save(item.id, { availability: state, until: "tonight" }).then((ok) => {
      if (!ok) setEditing((e) => (e?.id === item.id ? null : e));
    });
  };

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      categories
        .map((c) => ({
          ...c,
          items: c.items.filter((i) => !q || i.name.toLowerCase().includes(q)),
        }))
        .filter((c) => c.items.length),
    [categories, q],
  );
  const offCount = [...rows.values()].filter(
    (r) => r.availability !== "available",
  ).length;
  const untilFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Label htmlFor="board-search" className="sr-only">
            Find a dish
          </Label>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            id="board-search"
            type="search"
            placeholder="Find a dish…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 ps-9 text-base"
          />
        </div>
        {canReset && (
          <ResetAll disabled={offCount === 0} onDone={() => router.refresh()} />
        )}
      </div>
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {offCount === 0
          ? "Everything is available."
          : `${offCount} dish${offCount === 1 ? "" : "es"} not fully available.`}
      </p>

      {visible.map((category) => (
        <section key={category.id} aria-labelledby={`cat-${category.id}`}>
          <h2
            id={`cat-${category.id}`}
            className="bg-background/95 text-muted-foreground sticky top-[7.5rem] z-10 -mx-4 px-4 py-2 text-sm font-semibold tracking-wide uppercase backdrop-blur"
          >
            {category.name}
          </h2>
          <ul className="space-y-3">
            {category.items.map(({ id }) => {
              const item = rows.get(id)!;
              return (
                <li key={id} className="rounded-2xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg leading-tight font-medium">
                      {item.name}
                    </p>
                    {item.availability !== "available" && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            id,
                            state: item.availability,
                            until: item.availability_until
                              ? "tonight"
                              : "manual",
                          })
                        }
                        className="min-h-11 shrink-0 px-2 text-sm underline underline-offset-4"
                      >
                        Details
                      </button>
                    )}
                  </div>
                  {item.availability !== "available" &&
                    (item.availability_note ||
                      item.remaining_qty != null ||
                      item.availability_until) && (
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {[
                          item.remaining_qty != null &&
                          item.availability === "limited"
                            ? `${item.remaining_qty} left`
                            : null,
                          item.availability_note,
                          item.availability_until
                            ? `until ${untilFmt.format(new Date(item.availability_until))}`
                            : "until changed",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  <div
                    role="radiogroup"
                    aria-label={`${item.name} availability`}
                    className="mt-3 grid grid-cols-3 gap-2"
                  >
                    {STATES.map((s) => {
                      const on = item.availability === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => onTap(item, s.value)}
                          className={cn(
                            "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-sm font-semibold transition-colors",
                            on
                              ? s.on
                              : "border-border bg-background text-foreground active:bg-muted",
                          )}
                        >
                          <s.icon aria-hidden="true" className="size-5" />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {editing && rows.get(editing.id) && (
        <DetailsSheet
          key={editing.id + editing.state}
          item={rows.get(editing.id)!}
          state={editing.state}
          initialUntil={editing.until}
          onClose={() => setEditing(null)}
          onSave={async (d) => {
            const ok = await save(editing.id, {
              availability: editing.state,
              ...d,
            });
            if (ok) {
              setEditing(null);
              toast.success("Saved");
            }
          }}
        />
      )}
    </div>
  );
}

function DetailsSheet({
  item,
  state,
  initialUntil,
  onClose,
  onSave,
}: {
  item: Item;
  state: State;
  initialUntil: UntilPreset;
  onClose: () => void;
  onSave: (d: {
    note: string | null;
    remainingQty: number | null;
    until: UntilPreset;
  }) => Promise<void>;
}) {
  const [note, setNote] = useState(item.availability_note ?? "");
  const [qty, setQty] = useState(item.remaining_qty?.toString() ?? "");
  const [until, setUntil] = useState<UntilPreset>(initialUntil);
  const [pending, start] = useTransition();
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>
            {item.name} — {state === "limited" ? "Limited" : "Sold out"}
          </SheetTitle>
          <SheetDescription>
            Optional. Diners see the note on the menu.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div className="space-y-1.5">
            <Label htmlFor="note">Note for diners</Label>
            <Input
              id="note"
              value={note}
              maxLength={140}
              placeholder={
                state === "limited"
                  ? "Last few portions tonight"
                  : "Back tomorrow"
              }
              onChange={(e) => setNote(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          {state === "limited" && (
            <div className="space-y-1.5">
              <Label htmlFor="qty">Portions left (optional)</Label>
              <Input
                id="qty"
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-12 text-base"
              />
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">How long?</legend>
            {UNTIL.map((u) => (
              <label
                key={u.value}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3",
                  until === u.value && "border-foreground bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="until"
                  value={u.value}
                  checked={until === u.value}
                  onChange={() => setUntil(u.value)}
                  className="accent-foreground size-5"
                />
                {u.label}
              </label>
            ))}
          </fieldset>
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={onClose}>
            Skip
          </Button>
          <Button
            className="h-12 flex-1"
            disabled={pending}
            onClick={() =>
              start(() =>
                onSave({
                  note: note.trim() || null,
                  remainingQty:
                    qty === "" ? null : Math.max(0, Math.floor(Number(qty))),
                  until,
                }),
              )
            }
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ResetAll({
  disabled,
  onDone,
}: {
  disabled: boolean;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="h-12"
          disabled={disabled || pending}
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Reset all</span>
          <span className="sr-only sm:hidden">Reset all to available</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Make every dish available?</AlertDialogTitle>
          <AlertDialogDescription>
            Clears all sold-out and limited states, notes and timers. Diners see
            the change right away.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="h-11"
            onClick={() =>
              start(async () => {
                const res = await resetAllAvailability();
                if (res.ok) {
                  toast.success(
                    `Reset ${res.count} dish${res.count === 1 ? "" : "es"} to available.`,
                  );
                  onDone();
                } else toast.error(res.error);
              })
            }
          >
            Reset all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
