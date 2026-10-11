import { AuthCard } from "@/components/admin/auth-card";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export default function NoAccessPage() {
  return (
    <AuthCard
      title="No access"
      description="Your account isn't active for this restaurant. Ask the owner to check your access."
    >
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-11 w-full">
          Sign out
        </Button>
      </form>
    </AuthCard>
  );
}
