import { ArrowLeftIcon, BookOpenIcon, UsersIcon } from "lucide-react";

import { SidebarFrame, SidebarSection } from "#/features/layout/sidebar-frame.tsx";
import type { SidebarProps } from "#/features/layout/sidebar-layout.tsx";
import { SidebarExternalLink, SidebarLink } from "#/features/layout/sidebar-link.tsx";

export function AdminSidebar({ currentUser }: SidebarProps) {
  return (
    <SidebarFrame currentUser={currentUser} home="/admin">
      <SidebarSection label="Administration">
        <SidebarLink to="/admin/users" icon={<UsersIcon />} label="Users" />
      </SidebarSection>
      <SidebarSection label="Developers" className="mt-auto">
        <SidebarExternalLink href="/api/docs" icon={<BookOpenIcon />} label="API docs" />
      </SidebarSection>
      <SidebarSection>
        <SidebarLink to="/app" icon={<ArrowLeftIcon />} label="Back to the app" />
      </SidebarSection>
    </SidebarFrame>
  );
}
