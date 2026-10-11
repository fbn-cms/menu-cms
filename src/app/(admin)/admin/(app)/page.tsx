import type { Metadata } from "next";
import Link from "next/link";
import { describeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

/** ISO timestamp `days` ago (this page renders per request, never cached). */
const since = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

const STATE_LABEL = { limited: "Limited", unavailable: "Sold out" } as const;

export default async function DashboardPage() {
  const ctx = await requireRole("owner", "admin"); // staff are sent to the 86 board
  const supabase = await createSupabaseServer();

  const [notAvailable, scansToday, scansWeek, recent] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, availability, availability_note")
      .neq("availability", "available")
      .eq("is_published", true)
      .order("availability", { ascending: false })
      .order("name"),
    supabase
      .from("scan_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since(1))
      .eq("is_bot", false),
    supabase
      .from("scan_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since(7))
      .eq("is_bot", false),
    ctx.profile.role === "owner"
      ? supabase
          .from("audit_log")
          .select("id, action, entity, after_json, before_json, occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(8)
      : supabase
          .from("items")
          .select("id, name, updated_at")
          .order("updated_at", { ascending: false })
          .limit(8),
  ]);

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.restaurant.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <section aria-labelledby="now" className="rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <h2 id="now" className="font-semibold">
            Not available right now
          </h2>
          <Link
            href="/admin/availability"
            className="text-sm underline underline-offset-4"
          >
            Open 86 board
          </Link>
        </div>
        {notAvailable.data?.length ? (
          <ul className="mt-3 divide-y">
            {notAvailable.data.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span>
                  {i.name}
                  {i.availability_note && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {i.availability_note}
                    </span>
                  )}
                </span>
                <span
                  className={
                    i.availability === "unavailable"
                      ? "font-medium"
                      : "text-amber-800"
                  }
                >
                  {STATE_LABEL[i.availability as keyof typeof STATE_LABEL]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">
            Everything is available.
          </p>
        )}
      </section>

      <section aria-labelledby="scans" className="grid grid-cols-2 gap-3">
        <h2 id="scans" className="sr-only">
          QR scans
        </h2>
        <Stat label="Menu scans today" value={scansToday.count ?? 0} />
        <Stat label="Last 7 days" value={scansWeek.count ?? 0} />
      </section>

      <section aria-labelledby="recent" className="rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="font-semibold">
            Recent changes
          </h2>
          {ctx.profile.role === "owner" && (
            <Link
              href="/admin/audit"
              className="text-sm underline underline-offset-4"
            >
              Full audit log
            </Link>
          )}
        </div>
        <ul className="mt-3 divide-y text-sm">
          {(recent.data ?? []).map((r) =>
            "action" in r ? (
              <li key={r.id} className="flex justify-between gap-3 py-2">
                <span>{describeAudit(r)}</span>
                <time className="text-muted-foreground shrink-0">
                  {fmt.format(new Date(r.occurred_at))}
                </time>
              </li>
            ) : (
              <li key={r.id} className="flex justify-between gap-3 py-2">
                <span>{r.name} updated</span>
                <time className="text-muted-foreground shrink-0">
                  {fmt.format(new Date(r.updated_at))}
                </time>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
