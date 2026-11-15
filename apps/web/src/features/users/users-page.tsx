import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { PageHeader } from "#/features/layout/page-header.tsx";
import { usersQueryOptions } from "#/features/users/users-query.ts";
import { UsersTable } from "#/features/users/users-table.tsx";

export function UsersPage() {
  const { page = 1 } = useSearch({ from: "/_authenticated/users" });
  const users = useQuery(usersQueryOptions(page));

  return (
    <>
      <PageHeader>
        <h1 className="text-sm font-medium">Users</h1>
        {users.data !== undefined && (
          <span className="ml-auto text-sm text-muted-foreground">{users.data.total} in all</span>
        )}
      </PageHeader>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <UsersTable page={page} />
      </div>
    </>
  );
}
