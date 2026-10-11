import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/auth-card";
import { createSupabaseServer } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/admin");
  const { next, error } = await searchParams;
  return (
    <AuthCard title="Sign in" description="Restaurant team only.">
      {error === "link" && (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-sm"
        >
          That link has expired or was already used. Request a new one below.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </AuthCard>
  );
}
