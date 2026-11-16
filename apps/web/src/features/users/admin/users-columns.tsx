import type { User } from "@quack/contracts/identity/user";
import type { UserOrder } from "@quack/contracts/users/users-api";
import { Badge } from "@quack/ui/components/badge";
import type { DataTableColumn, SortDirection } from "@quack/ui/components/data-table";
import { DataTableColumnHeader } from "@quack/ui/components/data-table-column-header";

export type UsersSorting = { readonly column: UserOrder; readonly direction: SortDirection };

export const usersColumns = ({
  sorting,
  onSort,
  onFilter,
}: {
  sorting: UsersSorting;
  onSort: (sorting: UsersSorting) => void;
  onFilter: (column: UserOrder) => void;
}): ReadonlyArray<DataTableColumn<User>> => {
  const header = (column: UserOrder, title: string) => () => (
    <DataTableColumnHeader
      title={title}
      sorted={sorting.column === column ? sorting.direction : undefined}
      onSort={(direction) => onSort({ column, direction })}
      onFilter={() => onFilter(column)}
    />
  );

  return [
    { accessorKey: "email", header: header("email", "Email") },
    {
      accessorKey: "role",
      header: header("role", "Role"),
      cell: ({ row }) =>
        row.original.role === "admin" ? (
          <Badge>Admin</Badge>
        ) : (
          <Badge variant="secondary">User</Badge>
        ),
    },
  ];
};
