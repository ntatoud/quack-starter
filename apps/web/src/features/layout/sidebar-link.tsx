import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "@quack/ui/components/sidebar";
import { Link, type LinkProps, useMatchRoute } from "@tanstack/react-router";
import { ArrowUpRightIcon } from "lucide-react";
import type { ReactNode } from "react";

export type LinkTarget = NonNullable<LinkProps["to"]>;

export function SidebarLink({
  to,
  icon,
  label,
}: {
  to: LinkTarget;
  icon: ReactNode;
  label: string;
}) {
  const matchRoute = useMatchRoute();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to={to} onClick={() => setOpenMobile(false)} />}
        isActive={matchRoute({ to }) !== false}
        tooltip={label}
      >
        {icon}
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** A page the router does not serve, such as the API's docs behind the relay: it opens in a new tab. */
export function SidebarExternalLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  const name = `${label}, opens in a new tab`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="sm"
        render={<a href={href} target="_blank" rel="noreferrer" aria-label={name} />}
        tooltip={name}
        className="text-sidebar-foreground/70"
      >
        {icon}
        <span>{label}</span>
        <ArrowUpRightIcon className="ml-auto" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
