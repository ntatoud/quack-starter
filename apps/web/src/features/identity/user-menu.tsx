import type { User } from "@quack/contracts/identity/user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@quack/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@quack/ui/components/sidebar";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";

import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { UserAvatar } from "#/features/users/user-avatar.tsx";
import { api } from "#/lib/api.ts";

export function UserMenu({ currentUser }: { currentUser: typeof User.Encoded }) {
  const { isMobile } = useSidebar();
  const setCurrentUser = useSetCurrentUser();
  const navigate = useNavigate();
  const signOut = useMutation(
    api.identity.signOut.mutationOptions({
      onSuccess: async () => {
        await setCurrentUser(null);
        await navigate({ to: "/sign-in" });
      },
    }),
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={(open) => open && signOut.isError && signOut.reset()}>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={displayName(currentUser)}
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <UserIdentity currentUser={currentUser} />
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
            className="w-(--anchor-width) min-w-56 rounded-lg"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm text-foreground">
                  <UserIdentity currentUser={currentUser} />
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Stays open on click, so a failed sign-out is said where it was asked. */}
            <DropdownMenuItem
              closeOnClick={false}
              disabled={signOut.isPending}
              onClick={() => signOut.mutate(undefined)}
            >
              <LogOutIcon />
              {signOut.isPending ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
            {signOut.isError && (
              <p role="alert" className="px-2 py-1.5 text-xs text-destructive">
                Could not sign out. Try again.
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserIdentity({ currentUser }: { currentUser: typeof User.Encoded }) {
  const name = displayName(currentUser);
  return (
    <>
      <UserAvatar user={currentUser} className="rounded-lg after:rounded-lg" />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        {name !== currentUser.email && (
          <span className="truncate text-xs">{currentUser.email}</span>
        )}
      </div>
    </>
  );
}

const displayName = ({ email, profile }: typeof User.Encoded) =>
  profile ? `${profile.firstName} ${profile.lastName}` : email;
