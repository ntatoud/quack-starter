import type { User } from "@quack/contracts/identity/user";
import { SidebarInset, SidebarProvider } from "@quack/ui/components/sidebar";
import { Outlet, useRouteContext } from "@tanstack/react-router";
import { type ComponentType, createContext, type ReactNode, use, useMemo } from "react";

import { useSidebarSide } from "#/features/preferences/preferences.ts";

export type SidebarProps = { readonly currentUser: typeof User.Encoded };

/** What a phone shows in place of the sidebar: a tab bar, and what the top bar of each page adds on its right. */
export type MobileNav = {
  readonly tabBar: ComponentType<SidebarProps>;
  readonly headerActions?: ComponentType<SidebarProps>;
};

// `null` where the sidebar is the navigation on a phone too.
const MobileHeader = createContext<{ readonly actions: ReactNode } | null>(null);

/** What the top bar of a page shows on a phone, when a tab bar takes the place of the sidebar there. */
export const useMobileHeader = () => use(MobileHeader);

export function SidebarLayout({
  sidebar: Sidebar,
  mobileNav,
}: {
  sidebar: ComponentType<SidebarProps>;
  mobileNav?: MobileNav;
}) {
  const { currentUser, sidebarOpen } = useRouteContext({ from: "/_authenticated" });
  const side = useSidebarSide();
  const sidebar = <Sidebar currentUser={currentUser} />;
  const HeaderActions = mobileNav?.headerActions;

  const mobileHeader = useMemo(
    () =>
      mobileNav === undefined
        ? null
        : { actions: HeaderActions && <HeaderActions currentUser={currentUser} /> },
    [mobileNav, HeaderActions, currentUser],
  );

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {/* The sidebar keeps its room with a spacer in the flow: its place in the DOM says on which side. */}
      {side === "left" && sidebar}
      {/* A flex item is as wide as its content by default: a wide table would push the page past the window. */}
      <SidebarInset className="min-w-0">
        <MobileHeader value={mobileHeader}>
          <Outlet />
        </MobileHeader>
        {mobileNav && <mobileNav.tabBar currentUser={currentUser} />}
      </SidebarInset>
      {side === "right" && sidebar}
    </SidebarProvider>
  );
}
