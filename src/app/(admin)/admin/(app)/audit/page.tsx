import type { Metadata } from "next";
import { describeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const ctx = await requireRole("owner");
  const supabase = await createSupabaseServer();
  const [{ data: rows }, { data: people }] = await Promise.all([
    supabase
      .from("audit_log")
      .select(
        "id, actor_id, action, entity, before_json, after_json, occurred_at",
      )
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const who = new Map(
    (people ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "Unknown"]),
  );
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.restaurant.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section aria-labelledby="audit">
      <h1 id="audit" className="mb-1 text-lg font-semibold">
        Audit log
      </h1>
      <p className="text-muted-foreground mb-4 text-sm">
        Every change, who made it and when. Latest 200.
      </p>
      <ol className="divide-y rounded-2xl border">
        {(rows ?? []).map((r) => (
          <li
            key={r.id}
            className="grid gap-0.5 p-3 text-sm sm:grid-cols-[1fr_auto] sm:gap-3"
          >
            <span>{describeAudit(r)}</span>
            <span className="text-muted-foreground sm:text-end">
              {r.actor_id ? (who.get(r.actor_id) ?? "Former member") : "System"}{" "}
              · {fmt.format(new Date(r.occurred_at))}
            </span>
          </li>
        ))}
        {!rows?.length && (
          <li className="text-muted-foreground p-3 text-sm">Nothing yet.</li>
        )}
      </ol>
    </section>
  );
}
