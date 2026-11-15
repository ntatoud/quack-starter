import type { User } from "@quack/contracts/identity/user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@quack/ui/components/sidebar";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { ListTodoIcon, UsersIcon } from "lucide-react";

import { isAdmin } from "#/features/identity/is-admin.ts";
import { UserMenu } from "#/features/identity/user-menu.tsx";
import { Logo } from "#/features/layout/logo.tsx";

export function AppSidebar({ currentUser }: { currentUser: typeof User.Encoded }) {
  const matchRoute = useMatchRoute();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const closeOnMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-2 overflow-hidden">
        <SidebarTrigger className="size-8 shrink-0" />
        <Link
          to="/"
          aria-label="Quack, home"
          className="rounded-md px-1 transition-opacity duration-200 ease-out outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:opacity-0"
          inert={collapsed}
          onClick={closeOnMobile}
        >
          <Logo />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/" onClick={closeOnMobile} />}
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
        {isAdmin(currentUser) && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link to="/users" onClick={closeOnMobile} />}
                    isActive={matchRoute({ to: "/users" }) !== false}
                    tooltip="Users"
                  >
                    <UsersIcon />
                    <span>Users</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu currentUser={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
