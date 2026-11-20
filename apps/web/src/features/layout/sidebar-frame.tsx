import {
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@quack/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { UserMenu } from "#/features/identity/user-menu.tsx";
import type { LinkTarget } from "#/features/layout/sidebar-link.tsx";
import { Logo } from "#/features/layout/logo.tsx";
import { SidebarContentWithMenu } from "#/features/layout/sidebar-context-menu.tsx";
import type { SidebarProps } from "#/features/layout/sidebar-layout.tsx";
import { usePreference } from "#/features/preferences/use-preference.ts";

export function SidebarFrame({
  currentUser,
  home,
  children,
}: SidebarProps & { home: LinkTarget; children: ReactNode }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const side = usePreference("right-sidebar") ? "right" : "left";

  return (
    <Sidebar side={side} collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-2 overflow-hidden">
        <SidebarTrigger className="size-8 shrink-0" />
        <Link
          to={home}
          aria-label="Quack, home"
          className="rounded-md px-1 transition-opacity duration-200 ease-out outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:opacity-0"
          inert={collapsed}
          onClick={() => setOpenMobile(false)}
        >
          <Logo />
        </Link>
      </SidebarHeader>
      <SidebarContentWithMenu>{children}</SidebarContentWithMenu>
      <SidebarFooter>
        <UserMenu currentUser={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function SidebarSection({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <SidebarGroup className={className}>
      {label !== undefined && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
