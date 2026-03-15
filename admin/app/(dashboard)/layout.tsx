"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "../../components/ui/sidebar";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/donations", label: "Donations" },
];

function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <span className="text-sm font-semibold">Anneta Targalt</span>
      </SidebarHeader>
      <SidebarContent className="px-2 py-2">
        <SidebarMenu>
          {navLinks.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton render={<Link href={href} />} isActive={active}>
                  {label}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t px-3 py-3">
        <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
          Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex items-center gap-2 border-b bg-white px-4 py-3 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">Anneta Targalt</span>
        </header>
        <div className="bg-gray-50 flex-1">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
