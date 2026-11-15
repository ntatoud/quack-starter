import type { User } from "@quack/contracts/identity/user";
import { Avatar, AvatarFallback } from "@quack/ui/components/avatar";
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
                tooltip={currentUser.email}
                className="p-1 group-data-[collapsible=icon]:p-1! data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar size="sm" className="rounded-md after:rounded-md">
              <AvatarFallback aria-hidden="true" className="rounded-md">
                {initial(currentUser.email)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-left text-sm">{currentUser.email}</span>
            <ChevronsUpDownIcon className="mr-1 ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
            className="w-(--anchor-width) min-w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">
                Signed in as <span className="text-foreground">{currentUser.email}</span>
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

const initial = (email: string) => (Array.from(email)[0] ?? "").toUpperCase();
