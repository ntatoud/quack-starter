import type { User } from "@quack/contracts/identity/user";
import { Button } from "@quack/ui/components/button";
import { DataTableColumnVisibility } from "@quack/ui/components/data-table/column-visibility";
import { DataTable } from "@quack/ui/components/data-table/data-table";
import { DataTablePagination } from "@quack/ui/components/data-table/pagination";
import {
  DataTableEmptyState,
  DataTableErrorState,
  DataTableLoadingState,
} from "@quack/ui/components/data-table/states";
import { DataTableToolbar } from "@quack/ui/components/data-table/toolbar";
import { matchQuery } from "@quack/ui-state/query";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Option } from "effect";
import { useMemo, type ReactNode } from "react";

import { usersColumns } from "#/features/users/admin/users-columns.tsx";
import { userLabel } from "#/features/users/full-name.ts";
import { usersQueryOptions } from "#/features/users/admin/users-query.ts";
import { usersPageSizes } from "#/features/users/admin/users-search.ts";
import type { UsersTable } from "#/features/users/admin/users-table.ts";

const userLink = (user: User) => (
  <Link to="/admin/users/$id" params={{ id: user.id }} aria-label={userLabel(user)} />
);

export function UsersList({ table }: { table: UsersTable }) {
  const users = useQuery(usersQueryOptions(table));
  // Relative dates count from when the page was fetched: the render stays pure, and they read the same until the next fetch.
  const columns = useMemo(() => usersColumns(new Date(users.dataUpdatedAt)), [users.dataUpdatedAt]);
  return (
    <>
      <DataTableToolbar
        table={table}
        search={{
          "aria-label": "Search users by name or email",
          placeholder: "Search by name or email",
          maxLength: 254,
        }}
      >
        <DataTableColumnVisibility table={table} columns={columns} />
      </DataTableToolbar>
      <UsersTableOf table={table} columns={columns} />
    </>
  );
}

function UsersTableOf({
  table,
  columns,
}: {
  table: UsersTable;
  columns: ReturnType<typeof usersColumns>;
}) {
  const users = useQuery(usersQueryOptions(table));
  const retry = () => void users.refetch();

  const shared = {
    table,
    columns,
    busy: users.isPlaceholderData,
    refreshing: users.isFetching,
    onRefresh: retry,
  };
  return matchQuery(users, {
    Pending: () => <UsersRows {...shared} data={[]} empty={<DataTableLoadingState />} />,
    Error: () => (
      <UsersRows
        {...shared}
        data={[]}
        empty={
          <DataTableErrorState
            title="Could not load the users"
            retry={retry}
            retrying={users.isFetching}
            failure={users.errorUpdatedAt}
          >
            Check your connection and try again.
          </DataTableErrorState>
        }
      />
    ),
    Success: ({ data: { items, total }, refreshError }) => (
      <UsersRows
        {...shared}
        data={items}
        total={total}
        refreshFailed={Option.isSome(refreshError)}
        empty={
          <DataTableEmptyState
            searchTerm={table.state.q?.trim() ?? ""}
            filtered={table.isFiltered}
            onReset={table.reset}
          >
            No users
          </DataTableEmptyState>
        }
      />
    ),
  });
}

// Every state renders it, so the table stays mounted, and keeps the focus, from one to the next.
function UsersRows({
  table,
  columns,
  data,
  empty,
  total,
  busy,
  refreshFailed = false,
  refreshing,
  onRefresh,
}: {
  table: UsersTable;
  columns: ReturnType<typeof usersColumns>;
  data: ReadonlyArray<User>;
  empty: ReactNode;
  total?: number;
  busy: boolean;
  refreshFailed?: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <>
      {refreshFailed && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <span>Could not refresh the users.</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            disabled={refreshing}
            onClick={onRefresh}
          >
            Try again
          </Button>
        </p>
      )}
      <DataTable
        table={table}
        columns={columns}
        data={data}
        getRowId={(user) => user.id}
        label="Users"
        busy={busy}
        empty={empty}
        rowLink={userLink}
        {...(total !== undefined && {
          footer: (
            <DataTablePagination
              table={table}
              total={total}
              pageSizes={usersPageSizes}
              busy={busy}
              aria-label="Pages of users"
            />
          ),
        })}
      />
    </>
  );
}
