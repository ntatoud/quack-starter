import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, ListFilterIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@quack/ui/lib/utils";

import { Button } from "@quack/ui/components/button";
import type { SortDirection } from "@quack/ui/lib/data-table/state";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@quack/ui/components/menu";

const sortIcons = { asc: ArrowUpIcon, desc: ArrowDownIcon } as const;

/**
 * The header of a column: a menu that sorts it, and filters it too when it has a filter. A column that only filters
 * is a button that opens its filter. `align="end"` sets it at the end of the cell, over a column of numbers.
 */
export function DataTableColumnHeader({
  title,
  sorted,
  onSort,
  onFilter,
  align = "start",
}: { title: string; align?: "start" | "end" } & (
  | {
      sorted: SortDirection | undefined;
      onSort: (direction: SortDirection) => void;
      /** Called once the menu has closed, so the filter it shows can take the focus. */
      onFilter?: () => void;
    }
  | { sorted?: undefined; onSort?: undefined; onFilter: () => void }
)) {
  // Read when the menu closes: the filter takes the focus, not the header.
  const filtering = React.useRef(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // The ghost button's padding is pulled back, so its label lines up with the cells under it, and it takes the
  // text size of a plain header, which a small button would shrink.
  const buttonClassName = cn("text-sm", align === "end" ? "-me-2.5" : "-ms-2.5");
  const hintId = React.useId();

  if (onSort === undefined)
    return (
      // Named by its title alone, as the column it heads: what it does is its description.
      <Button
        data-slot="data-table-column-header"
        variant="ghost"
        size="sm"
        className={buttonClassName}
        aria-describedby={hintId}
        onClick={onFilter}
      >
        {align === "end" && <ListFilterIcon className="text-muted-foreground" />}
        {title}
        {align !== "end" && <ListFilterIcon className="text-muted-foreground" />}
        <span id={hintId} hidden>
          Filter
        </span>
      </Button>
    );

  const HeaderIcon = sorted === undefined ? ChevronsUpDownIcon : sortIcons[sorted];
  const icon = <HeaderIcon className={cn(sorted === undefined && "text-muted-foreground")} />;

  return (
    <Menu
      onOpenChange={(next) => {
        if (next) filtering.current = false;
      }}
      onOpenChangeComplete={(next) => {
        if (next || !filtering.current) return;
        onFilter?.();
      }}
    >
      <MenuTrigger
        render={
          <Button
            ref={triggerRef}
            data-slot="data-table-column-header"
            variant="ghost"
            size="sm"
            className={buttonClassName}
          />
        }
      >
        {/* Over a column of numbers, the icon comes first: the title then lines up with the figures. */}
        {align === "end" && icon}
        {title}
        {align !== "end" && icon}
      </MenuTrigger>
      <MenuContent
        className="min-w-36"
        finalFocus={() => (filtering.current ? null : triggerRef.current)}
      >
        <MenuRadioGroup value={sorted ?? null} onValueChange={(direction) => onSort(direction)}>
          <MenuRadioItem value="asc" closeOnSelect>
            <ArrowUpIcon className="text-muted-foreground" />
            Ascending
          </MenuRadioItem>
          <MenuRadioItem value="desc" closeOnSelect>
            <ArrowDownIcon className="text-muted-foreground" />
            Descending
          </MenuRadioItem>
        </MenuRadioGroup>
        {onFilter !== undefined && (
          <>
            <MenuSeparator />
            <MenuItem
              onSelect={() => {
                filtering.current = true;
              }}
            >
              <ListFilterIcon className="text-muted-foreground" />
              Filter
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
