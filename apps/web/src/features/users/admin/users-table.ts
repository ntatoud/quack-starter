import { defaultPageSize } from "@quack/contracts/pagination/paginated";

import { useRouterDataTable } from "#/components/data-table/use-router-data-table.ts";
import { usersFilters } from "#/features/users/admin/users-filters.ts";
import { defaultUsersSorting, type UsersSearch } from "#/features/users/admin/users-search.ts";

export const useUsersTable = (search: UsersSearch) =>
  useRouterDataTable({
    search,
    defaultSorting: defaultUsersSorting,
    defaultPageSize,
    filters: usersFilters,
  });

export type UsersTable = ReturnType<typeof useUsersTable>;
