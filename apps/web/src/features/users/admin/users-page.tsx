import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { PageContent } from "#/features/layout/page-content.tsx";
import { PageHeader } from "#/features/layout/page-header.tsx";
import { usersQueryOptions } from "#/features/users/admin/users-query.ts";
import { UsersList } from "#/features/users/admin/users-list.tsx";
import { useUsersTable } from "#/features/users/admin/users-table.ts";

export function UsersPage() {
  const table = useUsersTable(useSearch({ from: "/_authenticated/admin/users/" }));
  const users = useQuery(usersQueryOptions(table));

  return (
    <div className="flex h-svh flex-col">
      <PageHeader title="Users">
        {users.data !== undefined && (
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {users.data.total} {table.isFiltered ? "found" : "in all"}
          </span>
        )}
      </PageHeader>
      <PageContent className="min-h-0 flex-1">
        <UsersList table={table} />
      </PageContent>
    </div>
  );
}
