"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { TranslationStatus } from "@/components/admin/language-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reorderCategories } from "@/lib/actions/cms";

type Row = {
  id: string;
  name: string;
  is_published: boolean;
  itemCount: number;
  has: { fa: boolean; fr: boolean };
};

/** Reorder with ↑/↓ buttons: works one-handed on a phone, with a keyboard and a screen reader. */
export function CategoryList({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [base, setBase] = useState(initial);
  if (base !== initial) {
    setBase(initial);
    setRows(initial);
  }
  const [pending, start] = useTransition();

  const move = (index: number, delta: -1 | 1) => {
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved!);
    const before = rows;
    setRows(next); // optimistic
    start(async () => {
      const res = await reorderCategories(next.map((r) => r.id));
      if (!res.ok) {
        setRows(before);
        toast.error(res.error);
      }
    });
  };

  if (!rows.length) {
    return (
      <p className="text-muted-foreground rounded-2xl border p-6 text-center text-sm">
        No categories yet.
      </p>
    );
  }
  return (
    <ol className="divide-y rounded-2xl border" aria-busy={pending}>
      {rows.map((c, i) => (
        <li key={c.id} className="flex items-center gap-2 p-3">
          <div className="flex flex-col">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={`Move ${c.name} up`}
              disabled={i === 0 || pending}
              onClick={() => move(i, -1)}
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={`Move ${c.name} down`}
              disabled={i === rows.length - 1 || pending}
              onClick={() => move(i, 1)}
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{c.name}</p>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-xs">
              <span>
                {c.itemCount} {c.itemCount === 1 ? "dish" : "dishes"}
              </span>
              <TranslationStatus has={c.has} />
              {!c.is_published && (
                <Badge variant="outline" className="gap-1">
                  <EyeOff aria-hidden="true" className="size-3" />
                  Hidden
                </Badge>
              )}
            </div>
          </div>
          <Button asChild variant="outline" className="h-11">
            <Link href={`/admin/categories/${c.id}`}>
              <Pencil aria-hidden="true" className="size-4" />
              Edit
            </Link>
          </Button>
        </li>
      ))}
    </ol>
  );
}
