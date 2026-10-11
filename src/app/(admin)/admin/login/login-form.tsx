"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/admin/auth-card";
import {
  sendMagicLink,
  sendPasswordReset,
  signInWithPassword,
  type FormState,
} from "@/lib/actions/auth";

type Mode = "password" | "link" | "reset";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [pwState, pwAction, pwPending] = useActionState<FormState, FormData>(
    signInWithPassword,
    {},
  );
  const [linkState, linkAction, linkPending] = useActionState<
    FormState,
    FormData
  >(sendMagicLink, {});
  const [resetState, resetAction, resetPending] = useActionState<
    FormState,
    FormData
  >(sendPasswordReset, {});

  if (mode === "password") {
    return (
      <form action={pwAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field id="email" label="Email" type="email" autoComplete="username" />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
        />
        <FormMessage state={pwState} />
        <Button type="submit" className="h-11 w-full" disabled={pwPending}>
          {pwPending ? "Signing in…" : "Sign in"}
        </Button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="min-h-11 underline underline-offset-4"
            onClick={() => setMode("link")}
          >
            Email me a sign-in link
          </button>
          <button
            type="button"
            className="min-h-11 underline underline-offset-4"
            onClick={() => setMode("reset")}
          >
            Forgot password?
          </button>
        </div>
      </form>
    );
  }
  const isLink = mode === "link";
  return (
    <form action={isLink ? linkAction : resetAction} className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {isLink
          ? "We'll email you a one-time link that signs you in."
          : "We'll email you a link to choose a new password."}
      </p>
      <Field id="email" label="Email" type="email" autoComplete="username" />
      <FormMessage state={isLink ? linkState : resetState} />
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={isLink ? linkPending : resetPending}
      >
        {isLink ? "Send sign-in link" : "Send reset link"}
      </Button>
      <button
        type="button"
        className="min-h-11 text-sm underline underline-offset-4"
        onClick={() => setMode("password")}
      >
        Back to password sign-in
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="h-11 text-base"
      />
    </div>
  );
}
