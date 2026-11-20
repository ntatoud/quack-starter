import { SidebarTrigger } from "@quack/ui/components/sidebar";
import type { ReactNode } from "react";

import { BackButton } from "#/components/back-button.tsx";
import { AppBreadcrumb, type Crumb } from "#/features/layout/app-breadcrumb.tsx";

/** The top bar of a page: a Back button when `back` is set, the breadcrumb, then `children`, such as a count. */
export function PageHeader({
  title,
  trail,
  back = false,
  children,
}: {
  title: string;
  trail?: ReadonlyArray<Crumb>;
  back?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1 md:hidden" />
      {back && <BackButton />}
      <AppBreadcrumb title={title} trail={trail} />
      {children}
    </header>
  );
}
