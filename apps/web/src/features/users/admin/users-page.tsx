import { useSearch } from "@tanstack/react-router";

import { PageContent } from "#/features/layout/page-content.tsx";
import { PageHeader } from "#/features/layout/page-header.tsx";
import { UsersList } from "#/features/users/admin/users-list.tsx";
import { useUsersTable } from "#/features/users/admin/users-table.ts";

export function UsersPage() {
  const table = useUsersTable(useSearch({ from: "/_authenticated/admin/users/" }));

  return (
    <div className="flex h-svh flex-col">
      <PageHeader title="Users" />
      <PageContent className="min-h-0 flex-1">
        <UsersList table={table} />
      </PageContent>
    </div>
  );
}
