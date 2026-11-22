import type { User } from "@quack/contracts/identity/user";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuGroupLabel,
  MenuSeparator,
  MenuTrigger,
} from "@quack/ui/components/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@quack/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from "lucide-react";

import { useSignOut } from "#/features/identity/use-sign-out.ts";
import { useSidebarSide } from "#/features/preferences/preferences.ts";
import { fullName } from "#/features/users/full-name.ts";
import { UserAvatar } from "#/features/users/user-avatar.tsx";

export function UserMenu({ currentUser }: { currentUser: typeof User.Encoded }) {
  const { isMobile } = useSidebar();
  const signOut = useSignOut();
  const sidebarSide = useSidebarSide();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu onOpenChange={(open) => open && signOut.isError && signOut.reset()}>
          <MenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={displayName(currentUser)}
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <UserIdentity currentUser={currentUser} />
            <ChevronsUpDownIcon className="ml-auto" />
          </MenuTrigger>
          <MenuContent
            side={isMobile ? "bottom" : sidebarSide === "right" ? "left" : "right"}
            align="end"
            sideOffset={4}
            className="w-(--anchor-width) min-w-56 rounded-lg"
          >
            <MenuGroup>
              <MenuGroupLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm text-foreground">
                  <UserIdentity currentUser={currentUser} />
                </div>
              </MenuGroupLabel>
            </MenuGroup>
            <MenuSeparator />
            <MenuGroup>
              <MenuItem render={<Link to="/app/settings/profile" />}>
                <SettingsIcon />
                Settings
              </MenuItem>
            </MenuGroup>
            <MenuSeparator />
            {/* Stays open on click, so a failed sign-out is said where it was asked. */}
            <MenuItem
              closeOnSelect={false}
              disabled={signOut.isPending}
              onSelect={() => signOut.mutate(undefined)}
            >
              <LogOutIcon />
              {signOut.isPending ? "Signing out…" : "Sign out"}
            </MenuItem>
            {signOut.isError && (
              <p role="alert" className="px-2 py-1.5 text-xs text-destructive">
                Could not sign out. Try again.
              </p>
            )}
          </MenuContent>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserIdentity({ currentUser }: { currentUser: typeof User.Encoded }) {
  const { email, profile } = currentUser;
  return (
    <>
      <UserAvatar user={currentUser} />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{displayName(currentUser)}</span>
        {profile && <span className="truncate text-xs text-muted-foreground">{email}</span>}
      </div>
    </>
  );
}

const displayName = ({ email, profile }: typeof User.Encoded) =>
  profile ? fullName(profile) : email;
