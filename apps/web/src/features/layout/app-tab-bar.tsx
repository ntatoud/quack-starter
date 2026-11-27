import { Link } from "@tanstack/react-router";
import { CalendarCheckIcon, ListTodoIcon, SettingsIcon, ShieldIcon } from "lucide-react";

import { ButtonLink } from "#/components/button-link.tsx";
import type { ReactNode } from "react";
import { isAdmin } from "#/features/identity/is-admin.ts";
import type { SidebarProps } from "#/features/layout/sidebar-layout.tsx";
import type { LinkTarget } from "#/features/layout/sidebar-link.tsx";

/** The pages of the app at the bottom of a phone's screen, where the sidebar is on a wider one. */
export function AppTabBar() {
  return (
    <nav
      aria-label="Main"
      // Sticks to the bottom of the window as the page scrolls, and lifts above the home indicator of an iPhone. On
      // the surface of the sidebar, whose place it takes on a phone, see-through as shadcn's translucent menus: the blur
      // sits on a layer of its own, behind the tabs.
      className="sticky bottom-0 z-10 mt-auto border-t border-sidebar-border bg-sidebar/70 pb-[env(safe-area-inset-bottom)] text-sidebar-foreground shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.12)] before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:backdrop-blur-2xl before:backdrop-saturate-150 md:hidden"
    >
      <ul className="flex">
        <Tab to="/app/today" icon={<CalendarCheckIcon />} label="Today" />
        <Tab to="/app" exact icon={<ListTodoIcon />} label="Todos" />
        <Tab to="/app/settings" icon={<SettingsIcon />} label="Settings" />
      </ul>
    </nav>
  );
}

function Tab({
  to,
  exact = false,
  icon,
  label,
}: {
  to: LinkTarget;
  exact?: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <li className="flex-1">
      <Link
        to={to}
        activeOptions={{ exact }}
        className="flex h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground outline-hidden transition-colors focus-visible:bg-sidebar-accent aria-[current=page]:text-sidebar-foreground [&_svg]:size-5"
      >
        {icon}
        {label}
      </Link>
    </li>
  );
}

/** The way to the administration, for an Admin: the top right of the page on a phone, out of the tabs of the app. */
export function AppHeaderActions({ currentUser }: SidebarProps) {
  if (!isAdmin(currentUser)) return null;

  return (
    <ButtonLink
      to="/admin"
      variant="ghost"
      size="icon-sm"
      aria-label="Administration"
      className="-mr-1.5"
    >
      <ShieldIcon aria-hidden />
    </ButtonLink>
  );
}
