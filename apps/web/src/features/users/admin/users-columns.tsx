import type { User } from "@quack/contracts/identity/user";
import type { DataTableColumnFor } from "@quack/ui/components/data-table/data-table";

import {
  CountryCell,
  DateCell,
  NameCell,
  OnboardedCell,
  RoleBadge,
  StatusBadge,
  TimeAgoCell,
} from "#/features/users/admin/users-cells.tsx";
import { labelOf } from "#/features/users/admin/users-filters.ts";
import type { UsersSearch } from "#/features/users/admin/users-search.ts";

/** `now` is what a relative date counts from. */
export const usersColumns = (now: Date): ReadonlyArray<DataTableColumnFor<User, UsersSearch>> => [
  {
    id: "name",
    title: "Name",
    sortable: true,
    filter: "search",
    cell: ({ row }) => <NameCell user={row.original} />,
  },
  { id: "email", accessorKey: "email", title: "Email", sortable: true, filter: "search" },
  {
    id: "status",
    title: "Status",
    sortable: true,
    filter: "status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "role",
    title: "Role",
    sortable: true,
    filter: "role",
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
  },
  {
    id: "team",
    title: "Team",
    sortable: true,
    filter: "team",
    cell: ({ row: { original } }) =>
      original.profile?.team == null ? null : labelOf("team", original.profile.team),
  },
  {
    id: "jobTitle",
    title: "Job title",
    cell: ({ row: { original } }) =>
      original.profile === null ? null : (
        <span className="block max-w-48 truncate" title={original.profile.jobTitle}>
          {original.profile.jobTitle}
        </span>
      ),
  },
  {
    id: "country",
    title: "Country",
    sortable: true,
    cell: ({ row: { original } }) =>
      original.profile?.country == null ? null : <CountryCell code={original.profile.country} />,
  },
  {
    id: "onboardedAt",
    title: "Onboarded",
    sortable: true,
    filter: "onboarded",
    cell: ({ row }) => <OnboardedCell date={row.original.onboardedAt} />,
  },
  {
    id: "createdAt",
    title: "Created",
    sortable: true,
    cell: ({ row }) => <DateCell date={row.original.createdAt} />,
  },
  {
    id: "lastSignInAt",
    title: "Last sign-in",
    sortable: true,
    cell: ({ row }) => <TimeAgoCell date={row.original.lastSignInAt} now={now} />,
  },
];
