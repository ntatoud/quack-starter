import type { User } from "@quack/contracts/identity/user";
import { SidebarInset, SidebarProvider } from "@quack/ui/components/sidebar";
import { Outlet, useRouteContext } from "@tanstack/react-router";
import type { ComponentType } from "react";

import { usePreference } from "#/features/preferences/use-preference.ts";

export type SidebarProps = { readonly currentUser: typeof User.Encoded };

export function SidebarLayout({ sidebar: Sidebar }: { sidebar: ComponentType<SidebarProps> }) {
  const { currentUser, sidebarOpen } = useRouteContext({ from: "/_authenticated" });
  const side = usePreference("right-sidebar") ? "right" : "left";
  const sidebar = <Sidebar currentUser={currentUser} />;

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {/* The sidebar keeps its room with a spacer in the flow: its place in the DOM says on which side. */}
      {side === "left" && sidebar}
      {/* A flex item is as wide as its content by default: a wide table would push the page past the window. */}
      <SidebarInset className="min-w-0">
        <Outlet />
      </SidebarInset>
      {side === "right" && sidebar}
    </SidebarProvider>
  );
}
