import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { PageHeader } from "#/features/layout/page-header.tsx";
import { usersQueryOptions } from "#/features/users/admin/users-query.ts";
import { UsersTable } from "#/features/users/admin/users-table.tsx";

export function UsersPage() {
  const { page = 1 } = useSearch({ from: "/_authenticated/_admin/users" });
  const users = useQuery(usersQueryOptions(page));

  return (
    <div className="flex h-svh flex-col">
      <PageHeader>
        <h1 className="text-sm font-medium">Users</h1>
        {users.data !== undefined && (
          <span className="ml-auto text-sm text-muted-foreground">{users.data.total} in all</span>
        )}
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <UsersTable page={page} />
      </div>
    </div>
  );
}
