import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

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
          <span className="ml-auto text-sm text-muted-foreground">
            {users.data.total} {table.isFiltered ? "found" : "in all"}
          </span>
        )}
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <UsersList table={table} />
      </div>
    </div>
  );
}
