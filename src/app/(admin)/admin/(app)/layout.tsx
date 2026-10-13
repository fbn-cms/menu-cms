import { LogOut } from "lucide-react";
import { AdminNav, type NavItem } from "@/components/admin/admin-nav";
import { getStaffContext, type Role } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";

// Navigation per role (spec §3). The UI only reflects permissions; RLS enforces them.
const NAV: (NavItem & { roles: Role[] })[] = [
  { href: "/admin", label: "Dashboard", roles: ["owner", "admin"] },
  {
    href: "/admin/availability",
    label: "86 board",
    roles: ["owner", "admin", "staff"],
  },
  { href: "/admin/items", label: "Dishes", roles: ["owner", "admin"] },
  { href: "/admin/categories", label: "Categories", roles: ["owner", "admin"] },
  { href: "/admin/tags", label: "Labels", roles: ["owner", "admin"] },
  { href: "/admin/team", label: "Team", roles: ["owner"] },
  { href: "/admin/settings", label: "Settings", roles: ["owner"] },
  { href: "/admin/audit", label: "Audit log", roles: ["owner"] },
];

export default async function AdminAppLayout({
  children,
}: LayoutProps<"/admin">) {
  const ctx = await getStaffContext();
  const items = NAV.filter((n) => n.roles.includes(ctx.profile.role)).map(
    ({ href, label }) => ({ href, label }),
  );
  return (
    <div className="bg-background mx-auto min-h-dvh max-w-3xl">
      <header className="bg-background/95 sticky top-0 z-30 border-b px-4 pt-3 pb-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{ctx.restaurant.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {ctx.profile.full_name ?? ctx.email} ·{" "}
              <span className="capitalize">{ctx.profile.role}</span>
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="hover:bg-muted inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </button>
          </form>
        </div>
        <div className="mt-2">
          <AdminNav items={items} />
        </div>
      </header>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}
