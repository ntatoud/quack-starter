import { SidebarTrigger } from "@quack/ui/components/sidebar";
import type { ReactNode } from "react";

export function PageHeader({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1 md:hidden" />
      {children}
    </header>
  );
}
