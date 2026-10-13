"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteMember,
  sendPasswordLink,
  updateMember,
  type TeamResult,
} from "@/lib/actions/team";

export function InviteForm() {
  const [state, action, pending] = useActionState<TeamResult, FormData>(
    inviteMember,
    { ok: false },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    } else if (state.error) toast.error(state.error);
  }, [state]);
  return (
    <form
      ref={formRef}
      action={action}
      className="mt-4 grid gap-3 sm:grid-cols-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Name</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          maxLength={120}
          className="h-11 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          className="h-11 text-base"
        />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Role</legend>
        <div className="flex gap-2">
          {(["staff", "admin"] as const).map((r) => (
            <label
              key={r}
              className="has-[:checked]:border-foreground has-[:checked]:bg-muted flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3"
            >
              <input
                type="radio"
                name="role"
                value={r}
                defaultChecked={r === "staff"}
                className="accent-foreground size-4"
              />
              <span className="capitalize">{r}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" className="h-11 sm:col-span-2" disabled={pending}>
        {pending ? "Sending invite…" : "Send invite"}
      </Button>
    </form>
  );
}

type Member = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "owner" | "admin" | "staff";
  is_active: boolean;
};

export function MemberRow({
  member,
  isSelf,
  neverSignedIn,
}: {
  member: Member;
  isSelf: boolean;
  neverSignedIn: boolean;
}) {
  const [pending, start] = useTransition();
  const run = (input: Parameters<typeof updateMember>[0], ok: string) =>
    start(async () => {
      const res = await updateMember(input);
      if (res.ok) toast.success(ok);
      else toast.error(res.error);
    });
  const name = member.full_name ?? member.email ?? "Unknown";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {name}{" "}
          {isSelf && (
            <span className="text-muted-foreground text-sm font-normal">
              (you)
            </span>
          )}
        </p>
        <p className="text-muted-foreground truncate text-sm">{member.email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={member.role === "owner" ? "default" : "secondary"}
          className="capitalize"
        >
          {member.role}
        </Badge>
        {!member.is_active && <Badge variant="outline">Deactivated</Badge>}
        {neverSignedIn && member.is_active && (
          <Badge variant="outline">Never signed in</Badge>
        )}
        {!isSelf && member.is_active && (
          // For an expired invite or a forgotten password. Works for co-owners too.
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await sendPasswordLink(member.id);
                if (res.ok) toast.success(res.message);
                else toast.error(res.error);
              })
            }
          >
            Send password link
          </Button>
        )}
        {!isSelf && member.role !== "owner" && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={pending || !member.is_active}
              onClick={() =>
                run(
                  {
                    id: member.id,
                    role: member.role === "staff" ? "admin" : "staff",
                  },
                  `${name} is now ${member.role === "staff" ? "an admin" : "staff"}.`,
                )
              }
            >
              Make {member.role === "staff" ? "admin" : "staff"}
            </Button>
            <Button
              variant={member.is_active ? "destructive" : "outline"}
              size="sm"
              className="min-h-11"
              disabled={pending}
              onClick={() =>
                run(
                  { id: member.id, isActive: !member.is_active },
                  member.is_active
                    ? `${name} can no longer sign in.`
                    : `${name} can sign in again.`,
                )
              }
            >
              {member.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
