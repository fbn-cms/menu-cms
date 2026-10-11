import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { MIN_PASSWORD } from "@/lib/auth-constants";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Choose a password" };

// Reached from an invite or password-reset email (the link already signed the user in).
export default function SetPasswordPage() {
  return (
    <AuthCard
      title="Choose a password"
      description="You'll use it with your email to sign in."
    >
      <SetPasswordForm minLength={MIN_PASSWORD} />
    </AuthCard>
  );
}
