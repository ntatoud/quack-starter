import type { User } from "@quack/contracts/identity/user";
import { SidebarInset, SidebarProvider } from "@quack/ui/components/sidebar";
import { TooltipProvider } from "@quack/ui/components/tooltip";
import { Outlet, useRouteContext } from "@tanstack/react-router";
import type { ComponentType } from "react";

export type SidebarProps = { readonly currentUser: User };

export function SidebarLayout({ sidebar: Sidebar }: { sidebar: ComponentType<SidebarProps> }) {
  const { currentUser, sidebarOpen } = useRouteContext({ from: "/_authenticated" });

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <Sidebar currentUser={currentUser} />
        {/* A flex item is as wide as its content by default: a wide table would push the page past the window. */}
        <SidebarInset className="min-w-0">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
