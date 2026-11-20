import { AdminSidebar } from "#/features/layout/admin/admin-sidebar.tsx";
import { SidebarLayout } from "#/features/layout/sidebar-layout.tsx";

export function AdminLayout() {
  return <SidebarLayout sidebar={AdminSidebar} />;
}
