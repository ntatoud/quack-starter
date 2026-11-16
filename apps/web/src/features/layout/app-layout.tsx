import { SidebarInset, SidebarProvider } from "@quack/ui/components/sidebar";
import { TooltipProvider } from "@quack/ui/components/tooltip";
import { Outlet, useRouteContext } from "@tanstack/react-router";

import { AppSidebar } from "#/features/layout/app-sidebar.tsx";

export function AppLayout() {
  const { currentUser, sidebarOpen } = useRouteContext({ from: "/_authenticated" });

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar currentUser={currentUser} />
        {/* A flex item is as wide as its content by default: a wide table would push the page past the window. */}
        <SidebarInset className="min-w-0">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
