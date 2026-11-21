import { SidebarTrigger } from "@quack/ui/components/sidebar";
import type { LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { BackButton } from "#/components/back-button.tsx";
import { AppBreadcrumb, type Crumb } from "#/features/layout/app-breadcrumb.tsx";

/**
 * The top bar of a page: a Back button when `back` is set, the breadcrumb, then `children`, such as a count, next to
 * the title it counts. `back` names where Back leads on a page the app was opened on, `/app` when it is `true`.
 */
export function PageHeader({
  title,
  trail,
  back = false,
  children,
}: {
  title: string;
  trail?: ReadonlyArray<Crumb>;
  back?: boolean | { readonly fallback: LinkProps["to"] };
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
      {/* Pulled out by their padding, so the icon, not the button, lines up with what the page shows. */}
      <SidebarTrigger className="-ml-1.5 md:hidden" />
      {back === true && <BackButton className="md:-ml-1.5" />}
      {typeof back === "object" && <BackButton fallback={back.fallback} className="md:-ml-1.5" />}
      <AppBreadcrumb title={title} trail={trail} />
      {children}
    </header>
  );
}
