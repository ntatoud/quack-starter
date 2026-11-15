import type { User } from "@quack/contracts/identity/user";
import { Badge } from "@quack/ui/components/badge";
import type { DataTableColumn } from "@quack/ui/components/data-table";

export const usersColumns: ReadonlyArray<DataTableColumn<User>> = [
  { accessorKey: "email", header: "Email" },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) =>
      row.original.role === "admin" ? (
        <Badge>Admin</Badge>
      ) : (
        <Badge variant="secondary">User</Badge>
      ),
  },
];
