import { PlusIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@quack/ui/components/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@quack/ui/components/menu";

/** Renders nothing once every filter is shown. */
export function DataTableAddFilter<Key extends string>({
  filters,
  onAdd,
  ref,
}: {
  filters: ReadonlyArray<{ readonly key: Key; readonly title: string }>;
  /** Called once the menu has closed, so the filter it adds can take the focus. */
  onAdd: (key: Key) => void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  // Read when the menu closes: the filter added takes the focus, not this button.
  const chosen = React.useRef<Key | null>(null);

  if (filters.length === 0) return null;

  return (
    <Menu
      onOpenChange={(next) => {
        if (next) chosen.current = null;
      }}
      onOpenChangeComplete={(next) => {
        const key = chosen.current;

        if (next || key === null) return;
        onAdd(key);
      }}
    >
      <MenuTrigger
        render={
          <Button ref={ref} data-slot="data-table-add-filter" variant="ghost" size="default" />
        }
      >
        <PlusIcon />
        Add filter
      </MenuTrigger>
      <MenuContent className="min-w-36">
        {filters.map(({ key, title }) => (
          <MenuItem
            key={key}
            onSelect={() => {
              chosen.current = key;
            }}
          >
            {title}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
