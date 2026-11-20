import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@quack/ui/components/context-menu";
import { SidebarContent } from "@quack/ui/components/sidebar";
import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { usePreference, useSetPreference } from "#/features/preferences/use-preference.ts";

/** The content of the sidebar, whose empty space opens a menu of the Preferences of the sidebar. */
export function SidebarContentWithMenu({ children }: { children: ReactNode }) {
  const rightSidebar = usePreference("right-sidebar");
  const setPreference = useSetPreference();

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<SidebarContent />}
        data-slot="sidebar-content"
        onContextMenu={(event) => {
          // A link or a button keeps the menu of the browser: open in a new tab, copy the address.
          if (event.target instanceof Element && event.target.closest("a, button")) {
            event.preventBaseUIHandler();
          }
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => setPreference("right-sidebar", !rightSidebar)}>
          {rightSidebar ? <PanelLeftIcon /> : <PanelRightIcon />}
          {rightSidebar ? "Move left" : "Move right"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
