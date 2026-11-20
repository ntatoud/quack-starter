import { ListTodoIcon, ShieldIcon } from "lucide-react";

import { isAdmin } from "#/features/identity/is-admin.ts";
import { SidebarFrame, SidebarSection } from "#/features/layout/sidebar-frame.tsx";
import type { SidebarProps } from "#/features/layout/sidebar-layout.tsx";
import { SidebarLink } from "#/features/layout/sidebar-link.tsx";

export function AppSidebar({ currentUser }: SidebarProps) {
  return (
    <SidebarFrame currentUser={currentUser} home="/app">
      <SidebarSection>
        <SidebarLink to="/app" icon={<ListTodoIcon />} label="Todos" />
      </SidebarSection>
      {isAdmin(currentUser) && (
        <SidebarSection className="mt-auto">
          <SidebarLink to="/admin" icon={<ShieldIcon />} label="Administration" />
        </SidebarSection>
      )}
    </SidebarFrame>
  );
}
