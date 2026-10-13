"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor, safeNext, type Role } from "@/lib/auth";
import { MIN_PASSWORD } from "@/lib/auth-constants";
import { absoluteUrl } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string };

const email = z.email().max(254);
// Same answer whether or not the account exists (no account enumeration).
const SENT =
  "If that email belongs to a team member, a link is on its way. Check your inbox.";

/**
 * Turn an auth email error into a user-facing result WITHOUT revealing whether the account
 * exists. "No such user" looks exactly like success; rate limits (Supabase allows one auth
 * email per address per minute, 30/hour per project) and real failures are shown honestly.
 */
function emailResult(
  error: { status?: number; code?: string; message: string } | null,
  what: string,
): FormState {
  if (!error) return { message: SENT };
  if (
    [
      "otp_disabled",
      "signup_disabled",
      "user_not_found",
      "email_address_not_authorized",
    ].includes(error.code ?? "")
  ) {
    return { message: SENT };
  }
  if (error.status === 429 || /rate_limit/.test(error.code ?? "")) {
    return {
      error: "Too many emails requested. Wait a minute, then try again.",
    };
  }
  console.error(`[auth] ${what} failed`, {
    status: error.status,
    code: error.code,
    message: error.message,
  });
  return {
    error: "We couldn't send the email right now. Try again in a few minutes.",
  };
}

export async function signInWithPassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = z
    .object({
      email,
      password: z.string().min(1).max(200),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return { error: "Wrong email or password." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  redirect(
    safeNext(
      parsed.data.next,
      profile ? homeFor(profile.role as Role) : "/admin/no-access",
    ),
  );
}

export async function sendMagicLink(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: absoluteUrl("/admin"),
    },
  });
  return emailResult(error, "magic link");
}

export async function sendPasswordReset(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: absoluteUrl("/admin/set-password"),
  });
  return emailResult(error, "password reset");
}

export async function setPassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = z
    .object({
      password: z.string().min(MIN_PASSWORD).max(200),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { message: "mismatch" })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return {
      error: parsed.error.issues.some((i) => i.message === "mismatch")
        ? "The two passwords don't match."
        : `Use at least ${MIN_PASSWORD} characters.`,
    };
  }
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };
  const { data: claims } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims?.claims?.sub ?? "")
    .maybeSingle();
  redirect(profile ? homeFor(profile.role) : "/admin/no-access");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
