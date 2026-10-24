"use client";

import {
  Building2,
  FileUp,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LogOut,
  Repeat,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "../../../components/brand-logo";
import { Button } from "../../../components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../../../components/ui/sidebar";

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/donations", label: "Donations", icon: HandCoins },
  { href: "/donors", label: "Donors", icon: Users },
  { href: "/recurring-donations", label: "Recurring", icon: Repeat },
  { href: "/transfers", label: "Transfers", icon: Send },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/statement", label: "Statement import", icon: FileUp },
  { href: "/transactions", label: "Transactions", icon: Landmark },
];

type User = {
  email: string;
};

export function AppSidebar({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  const displayName = user?.email ?? null;

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <Link href="/" className="flex flex-col items-start gap-2">
          <BrandLogo className="h-7 text-sidebar-primary" />
          <span className="text-sm leading-tight font-semibold">
            Anneta Targalt
            <span className="ml-1.5 font-normal text-muted-foreground">
              Admin
            </span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 py-2">
        <nav aria-label="Main">
          <SidebarMenu>
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    render={
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        // On a phone the menu covers the page, so it closes.
                        onClick={() => setOpenMobile(false)}
                      />
                    }
                    isActive={active}
                  >
                    <Icon />
                    {label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t px-3 py-3">
        {displayName && (
          <p className="truncate px-1 text-xs text-muted-foreground">
            {displayName}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut />
          Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
