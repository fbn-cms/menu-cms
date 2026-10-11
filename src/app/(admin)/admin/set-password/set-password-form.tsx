"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/admin/auth-card";
import { setPassword, type FormState } from "@/lib/actions/auth";

export function SetPasswordForm({ minLength }: { minLength: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    setPassword,
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={minLength}
          required
          className="h-11 text-base"
        />
        <p className="text-muted-foreground text-xs">
          At least {minLength} characters. A short sentence works well.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Repeat password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="h-11 text-base"
        />
      </div>
      <FormMessage state={state} />
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
