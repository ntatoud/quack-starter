import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { PageHeader } from "#/features/layout/page-header.tsx";
import { usersQueryOptions } from "#/features/users/admin/users-query.ts";
import { UsersList } from "#/features/users/admin/users-list.tsx";
import { isFiltered, usersQueryOf } from "#/features/users/admin/users-search.ts";

export function UsersPage() {
  const urlSearch = useSearch({ from: "/_authenticated/_admin/users" });
  const query = usersQueryOf(urlSearch);
  const users = useQuery(usersQueryOptions(query));

  return (
    <div className="flex h-svh flex-col">
      <PageHeader>
        <h1 className="text-sm font-medium">Users</h1>
        {users.data !== undefined && (
          <span className="ml-auto text-sm text-muted-foreground">
            {users.data.total} {isFiltered(query) ? "found" : "in all"}
          </span>
        )}
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <UsersList urlSearch={urlSearch} />
      </div>
    </div>
  );
}
