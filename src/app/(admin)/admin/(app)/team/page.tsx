import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { InviteForm, MemberRow } from "./team-client";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireRole("owner");
  const supabase = await createSupabaseServer();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at")
    .order("is_active", { ascending: false })
    .order("role")
    .order("full_name");

  return (
    <div className="space-y-6">
      <section aria-labelledby="invite" className="rounded-2xl border p-4">
        <h2 id="invite" className="font-semibold">
          Invite someone
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          They get an email to choose a password. <strong>Staff</strong> can
          only mark dishes available, limited or sold out.{" "}
          <strong>Admins</strong> can edit the whole menu but not settings or
          the team.
        </p>
        <InviteForm />
      </section>
      <section aria-labelledby="members">
        <h2 id="members" className="mb-2 font-semibold">
          Team ({members?.length ?? 0})
        </h2>
        <ul className="divide-y rounded-2xl border">
          {(members ?? []).map((m) => (
            <MemberRow key={m.id} member={m} isSelf={m.id === ctx.userId} />
          ))}
        </ul>
      </section>
    </div>
  );
}
