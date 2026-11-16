import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { PageHeader } from "#/features/layout/page-header.tsx";
import { usersQueryOptions } from "#/features/users/admin/users-query.ts";
import { UsersSearchInput } from "#/features/users/admin/users-search-input.tsx";
import { UsersTable } from "#/features/users/admin/users-table.tsx";

export function UsersPage() {
  const { page = 1, q = "" } = useSearch({ from: "/_authenticated/_admin/users" });
  const users = useQuery(usersQueryOptions(page, q));

  return (
    <div className="flex h-svh flex-col">
      <PageHeader>
        <h1 className="text-sm font-medium">Users</h1>
        {users.data !== undefined && (
          <span className="ml-auto text-sm text-muted-foreground">
            {users.data.total} {q.trim() === "" ? "in all" : "found"}
          </span>
        )}
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <UsersSearchInput search={q} />
        <UsersTable page={page} search={q} />
      </div>
    </div>
  );
}
