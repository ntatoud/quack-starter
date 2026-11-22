import { AppSidebar } from "#/features/layout/app-sidebar.tsx";
import { AppHeaderActions, AppTabBar } from "#/features/layout/app-tab-bar.tsx";
import { SidebarLayout } from "#/features/layout/sidebar-layout.tsx";

const mobileNav = { tabBar: AppTabBar, headerActions: AppHeaderActions };

export function AppLayout() {
  return <SidebarLayout sidebar={AppSidebar} mobileNav={mobileNav} />;
}
