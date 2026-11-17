import { Button } from "@quack/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@quack/ui/components/dropdown-menu";
import { Columns3Icon } from "lucide-react";

import {
  type HideableUsersColumn,
  hideableUsersColumns,
} from "#/features/users/admin/users-columns.tsx";

export function UsersColumnPicker({
  hidden,
  onHiddenChange,
}: {
  hidden: ReadonlySet<HideableUsersColumn>;
  onHiddenChange: (hidden: ReadonlySet<HideableUsersColumn>) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Columns3Icon aria-hidden="true" />
        Columns
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Shown columns</DropdownMenuLabel>
          {hideableUsersColumns.map(({ id, title }) => (
            <DropdownMenuCheckboxItem
              key={id}
              checked={!hidden.has(id)}
              onCheckedChange={(checked) => {
                const next = new Set(hidden);
                if (checked) next.delete(id);
                else next.add(id);
                onHiddenChange(next);
              }}
            >
              {title}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
