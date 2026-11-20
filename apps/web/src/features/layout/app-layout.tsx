import { AppSidebar } from "#/features/layout/app-sidebar.tsx";
import { SidebarLayout } from "#/features/layout/sidebar-layout.tsx";

export function AppLayout() {
  return <SidebarLayout sidebar={AppSidebar} />;
}
