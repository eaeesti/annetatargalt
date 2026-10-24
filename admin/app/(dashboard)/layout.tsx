import { redirect } from "next/navigation";
import { strapiAdmin } from "../../lib/api";
import { readJson } from "../../lib/read-json";
import { AppSidebar } from "./_components/app-sidebar";
import { BrandLogo } from "../../components/brand-logo";
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
    return await readJson<StrapiUser>(res);
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
      {/* For keyboard users: the first Tab offers to skip the sidebar. */}
      <a
        href="#content"
        className="sr-only rounded-md bg-background text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <AppSidebar user={user} />
      <SidebarInset className="overflow-auto">
        <header className="flex items-center gap-2 border-b bg-background px-4 py-3 md:hidden">
          <SidebarTrigger />
          <BrandLogo className="h-5 text-primary" />
          <span className="text-sm font-semibold">Anneta Targalt Admin</span>
        </header>
        <div className="min-w-0 flex-1 bg-muted/40">
          <div id="content" tabIndex={-1} className="px-6 py-8 outline-none">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
