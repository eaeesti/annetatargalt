import { redirect } from "next/navigation";
import { strapiAdmin } from "../../lib/api";
import { AppSidebar } from "./_components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../../components/ui/sidebar";

type StrapiUser = {
  email: string;
};

async function getCurrentUser(): Promise<StrapiUser | null> {
  try {
    const res = await strapiAdmin("/api/users/me");
    if (!res.ok) return null;
    return (await res.json()) as StrapiUser;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar user={user} />
      <SidebarInset className="overflow-auto">
        <header className="flex items-center gap-2 border-b bg-background px-4 py-3 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">Anneta Targalt Admin</span>
        </header>
        <div className="bg-muted/40 flex-1 min-w-0">
          <div className="px-6 py-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
