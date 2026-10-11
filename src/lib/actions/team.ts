"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export type TeamResult = { ok: boolean; error?: string; message?: string };

const invitable = z.enum(["admin", "staff"]);

/** Owner invites a team member: creates the auth user (invite email) and their profile. */
export async function inviteMember(
  _: TeamResult,
  form: FormData,
): Promise<TeamResult> {
  const ctx = await requireRole("owner");
  const parsed = z
    .object({
      email: z.email().max(254),
      full_name: z.string().trim().min(1).max(120),
      role: invitable,
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { ok: false, error: "Enter a name, a valid email and a role." };
  const { email, full_name, role } = parsed.data;

  const admin = createSupabaseAdmin();
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(
    email,
    { data: { full_name } },
  );
  if (error || !invited.user) {
    return {
      ok: false,
      error: /already/i.test(error?.message ?? "")
        ? "That email already has an account."
        : "Couldn't send the invite. Check the email address and try again.",
    };
  }
  const { error: profileError } = await admin
    .from("profiles")
    .insert({
      id: invited.user.id,
      restaurant_id: ctx.restaurant.id,
      email,
      full_name,
      role,
    });
  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id); // don't leave an account without a profile
    return {
      ok: false,
      error: "Couldn't create the profile. Nothing was changed.",
    };
  }
  // The audit trigger can't see who acted through the secret key; record the owner explicitly.
  await admin.from("audit_log").insert({
    restaurant_id: ctx.restaurant.id,
    actor_id: ctx.userId,
    action: "invite",
    entity: "profiles",
    entity_id: invited.user.id,
    after_json: { email, full_name, role },
  });
  revalidatePath("/admin/team");
  return { ok: true, message: `Invite sent to ${email}.` };
}

/** Owner changes a member's role or (de)activates them. RLS + trigger enforce the same rules. */
export async function updateMember(input: {
  id: string;
  role?: "admin" | "staff";
  isActive?: boolean;
}): Promise<TeamResult> {
  const ctx = await requireRole("owner");
  const parsed = z
    .object({
      id: z.uuid(),
      role: invitable.optional(),
      isActive: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  if (parsed.data.id === ctx.userId)
    return { ok: false, error: "You can't change your own access." };

  const supabase = await createSupabaseServer();
  const patch: { role?: "admin" | "staff"; is_active?: boolean } = {};
  if (parsed.data.role) patch.role = parsed.data.role;
  if (parsed.data.isActive !== undefined)
    patch.is_active = parsed.data.isActive;
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data?.length)
    return { ok: false, error: "Couldn't update. Try again." };

  if (parsed.data.isActive !== undefined) {
    // Deactivation also blocks sign-in and existing sessions at the auth layer.
    await createSupabaseAdmin().auth.admin.updateUserById(parsed.data.id, {
      ban_duration: parsed.data.isActive ? "none" : "876000h",
    });
  }
  revalidatePath("/admin/team");
  return { ok: true };
}
