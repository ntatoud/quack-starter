import { SidebarInset, SidebarProvider, SidebarTrigger } from "@quack/ui/components/sidebar";
import { TooltipProvider } from "@quack/ui/components/tooltip";
import { Outlet, useRouteContext } from "@tanstack/react-router";

import { AppSidebar } from "#/features/layout/app-sidebar.tsx";

export function AppLayout() {
  const { currentUser } = useRouteContext({ from: "/_authenticated" });

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar currentUser={currentUser} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center px-4">
            <SidebarTrigger className="-ml-1 md:hidden" />
          </header>
          <div className="flex-1 p-6 pt-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
