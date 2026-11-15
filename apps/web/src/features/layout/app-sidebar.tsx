import type { User } from "@quack/contracts/identity/user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@quack/ui/components/sidebar";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { ListTodoIcon } from "lucide-react";

import { UserMenu } from "#/features/identity/user-menu.tsx";

export function AppSidebar({ currentUser }: { currentUser: typeof User.Encoded }) {
  const matchRoute = useMatchRoute();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-2 overflow-hidden">
        <SidebarTrigger className="size-8 shrink-0" />
        <Link
          to="/"
          className="flex h-8 min-w-0 items-center gap-2 rounded-md px-1 transition-opacity duration-200 ease-out outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:opacity-0"
          inert={collapsed}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
            Q
          </span>
          <span className="truncate font-semibold">Quack</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/" />}
                  isActive={matchRoute({ to: "/" }) !== false}
                  tooltip="Todos"
                >
                  <ListTodoIcon />
                  <span>Todos</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu currentUser={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
