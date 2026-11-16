import * as React from "react";
import { cn } from "cn";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, ListFilterIcon } from "lucide-react";

import { Button } from "@quack/ui/components/button";
import type { SortDirection } from "@quack/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@quack/ui/components/dropdown-menu";

const sortIcons = { asc: ArrowUpIcon, desc: ArrowDownIcon } as const;

function DataTableColumnHeader({
  title,
  sorted,
  onSort,
  onFilter,
}: {
  title: string;
  sorted: SortDirection | undefined;
  onSort: (direction: SortDirection) => void;
  /** Called once the menu has closed, so the filter it shows can take the focus. */
  onFilter?: () => void;
}) {
  // Read when the menu closes: the filter takes the focus, not the header.
  const filtering = React.useRef(false);
  const SortedIcon = sorted === undefined ? ChevronsUpDownIcon : sortIcons[sorted];

  return (
    <DropdownMenu
      onOpenChange={(next) => {
        if (next) filtering.current = false;
      }}
      onOpenChangeComplete={(next) => {
        if (next || !filtering.current) return;
        filtering.current = false;
        onFilter?.();
      }}
    >
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="-ml-2.5" />}>
        {title}
        <SortedIcon
          data-icon="inline-end"
          className={cn(sorted === undefined && "text-muted-foreground")}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-36" finalFocus={() => !filtering.current}>
        <DropdownMenuRadioGroup
          value={sorted ?? null}
          onValueChange={(direction: SortDirection) => onSort(direction)}
        >
          <DropdownMenuRadioItem value="asc" closeOnClick>
            <ArrowUpIcon className="text-muted-foreground" />
            Ascending
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="desc" closeOnClick>
            <ArrowDownIcon className="text-muted-foreground" />
            Descending
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {onFilter !== undefined && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                filtering.current = true;
              }}
            >
              <ListFilterIcon className="text-muted-foreground" />
              Filter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DataTableColumnHeader };
