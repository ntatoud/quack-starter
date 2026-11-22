import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@quack/ui/components/sidebar";
import { Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { BotIcon, SlidersHorizontalIcon, UserIcon } from "lucide-react";

import { PageContent } from "#/features/layout/page-content.tsx";
import { PageHeader } from "#/features/layout/page-header.tsx";

export const sections = [
  { to: "/app/settings/profile", label: "Profile", icon: UserIcon },
  { to: "/app/settings/preferences", label: "Preferences", icon: SlidersHorizontalIcon },
  { to: "/app/settings/ai-clients", label: "AI Clients", icon: BotIcon },
] as const;

/**
 * The pages of the settings, a section each, with the menu of the sections on their left. A phone, too narrow for
 * both, lists the sections on `/app/settings` instead (`SettingsHome`), and shows one at a time.
 */
export function SettingsLayout() {
  const matchRoute = useMatchRoute();
  const current = sections.find(({ to }) => matchRoute({ to }) !== false);

  return (
    <>
      {current === undefined ? (
        <PageHeader title="Settings" />
      ) : (
        <PageHeader title={current.label} trail={[{ label: "Settings" }]} back />
      )}
      <PageContent className="max-w-4xl gap-6 md:flex-row md:gap-8">
        <nav aria-label="Settings" className="hidden md:block md:w-48 md:shrink-0">
          <SidebarMenu>
            {sections.map(({ to, label, icon: Icon }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  render={<Link to={to} />}
                  isActive={matchRoute({ to }) !== false}
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Outlet />
        </div>
      </PageContent>
    </>
  );
}
