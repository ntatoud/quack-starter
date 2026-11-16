import type { User } from "@quack/contracts/identity/user";
import type { UserOrder } from "@quack/contracts/users/users-api";
import { Badge } from "@quack/ui/components/badge";
import type { DataTableColumn, SortDirection } from "@quack/ui/components/data-table";
import { DataTableColumnHeader } from "@quack/ui/components/data-table-column-header";

import {
  CountryCell,
  DateCell,
  NameCell,
  StatusBadge,
  TagsCell,
  TimeAgoCell,
  VerifiedCell,
} from "#/features/users/admin/users-cells.tsx";
import { labelOf, usersFilterOfColumn } from "#/features/users/admin/users-filters.ts";

export type UsersSorting = { readonly column: UserOrder; readonly direction: SortDirection };

export const usersColumns = ({
  sorting,
  onSort,
  onFilter,
  now,
}: {
  sorting: UsersSorting;
  onSort: (sorting: UsersSorting) => void;
  onFilter: (column: UserOrder) => void;
  /** What a relative date counts from. */
  now: Date;
}): ReadonlyArray<DataTableColumn<User>> => {
  const header = (column: UserOrder, title: string) => () => (
    <DataTableColumnHeader
      title={title}
      sorted={sorting.column === column ? sorting.direction : undefined}
      onSort={(direction) => onSort({ column, direction })}
      {...(usersFilterOfColumn[column] !== undefined && { onFilter: () => onFilter(column) })}
    />
  );

  return [
    {
      id: "name",
      header: header("name", "Name"),
      cell: ({ row }) => <NameCell user={row.original} />,
    },
    { id: "email", accessorKey: "email", header: header("email", "Email") },
    {
      id: "status",
      header: header("status", "Status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "role",
      header: header("role", "Role"),
      cell: ({ row }) =>
        row.original.role === "admin" ? (
          <Badge>Admin</Badge>
        ) : (
          <Badge variant="secondary">User</Badge>
        ),
    },
    {
      id: "team",
      header: header("team", "Team"),
      cell: ({ row: { original } }) =>
        original.profile === null ? null : labelOf("team", original.profile.team),
    },
    {
      id: "jobTitle",
      header: "Job title",
      cell: ({ row: { original } }) =>
        original.profile === null ? null : (
          <span className="block max-w-48 truncate" title={original.profile.jobTitle}>
            {original.profile.jobTitle}
          </span>
        ),
    },
    {
      id: "country",
      header: header("country", "Country"),
      cell: ({ row: { original } }) =>
        original.profile === null ? null : <CountryCell code={original.profile.country} />,
    },
    {
      id: "tags",
      header: "Tags",
      cell: ({ row: { original } }) =>
        original.profile === null ? null : <TagsCell tags={original.profile.tags} />,
    },
    {
      id: "verified",
      header: "Verified",
      cell: ({ row }) => <VerifiedCell verifiedAt={row.original.emailVerifiedAt} />,
    },
    {
      id: "createdAt",
      header: header("createdAt", "Created"),
      cell: ({ row }) => <DateCell date={row.original.createdAt} />,
    },
    {
      id: "lastSignInAt",
      header: header("lastSignInAt", "Last sign-in"),
      cell: ({ row }) => <TimeAgoCell date={row.original.lastSignInAt} now={now} />,
    },
  ];
};
