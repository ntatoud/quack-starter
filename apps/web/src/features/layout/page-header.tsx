import { SidebarTrigger } from "@quack/ui/components/sidebar";
import type { ReactNode } from "react";

import { AppBreadcrumb, type Crumbs } from "#/features/layout/app-breadcrumb.tsx";
import { BackButton } from "#/features/layout/back-button.tsx";

/** The top bar of a page: its breadcrumb, a Back button when `back` is set, then `children`, such as a count. */
export function PageHeader({
  crumbs,
  back = false,
  children,
}: {
  crumbs: Crumbs;
  back?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1 md:hidden" />
      {back && <BackButton />}
      <AppBreadcrumb crumbs={crumbs} />
      {children}
    </header>
  );
}
