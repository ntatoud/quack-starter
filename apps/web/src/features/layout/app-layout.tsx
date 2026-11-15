import { SidebarInset, SidebarProvider } from "@quack/ui/components/sidebar";
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
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
