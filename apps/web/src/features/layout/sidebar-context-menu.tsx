import { Menu, MenuContent, MenuItem, createMenuController } from "@quack/ui/components/menu";
import { SidebarContent } from "@quack/ui/components/sidebar";
import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { usePreferences, useSidebarSide } from "#/features/preferences/preferences.ts";

/** The content of the sidebar, whose empty space opens a menu of the Preferences of the sidebar. */
export function SidebarContentWithMenu({ children }: { children: ReactNode }) {
  const { sidebarSide } = usePreferences();
  const isRightSidebar = useSidebarSide() === "right";
  const [controller] = useState(() => createMenuController<unknown, string>());

  return (
    <Menu controller={controller}>
      <SidebarContent
        onContextMenu={(event) => {
          // A link or a button keeps the menu of the browser (open in a new tab, copy the address), which a
          // context trigger would replace: so the menu opens from here, where the target can be read.
          if (event.target instanceof Element && event.target.closest("a, button")) return;
          event.preventDefault();
          void controller.open({ anchor: { x: event.clientX, y: event.clientY } });
        }}
      >
        {children}
      </SidebarContent>
      <MenuContent align="start" alignOffset={4} side="right">
        <MenuItem onSelect={() => sidebarSide.set(isRightSidebar ? "left" : "right")}>
          {isRightSidebar ? <PanelLeftIcon /> : <PanelRightIcon />}
          {isRightSidebar ? "Move left" : "Move right"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
