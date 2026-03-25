"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../../components/ui/sidebar";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/donations", label: "Donations" },
  { href: "/donors", label: "Donors" },
  { href: "/recurring-donations", label: "Recurring" },
  { href: "/transfers", label: "Transfers" },
  { href: "/organizations", label: "Organizations" },
];

type User = {
  email: string;
};

export function AppSidebar({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  const displayName = user?.email ?? null;

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <span className="text-sm font-semibold">Anneta Targalt Admin</span>
      </SidebarHeader>
      <SidebarContent className="px-2 py-2">
        <SidebarMenu>
          {navLinks.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  render={<Link href={href} />}
                  isActive={active}
                >
                  {label}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t px-3 py-3 gap-2">
        {displayName && (
          <p className="text-xs text-muted-foreground truncate px-1">
            {displayName}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleLogout}
        >
          Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
