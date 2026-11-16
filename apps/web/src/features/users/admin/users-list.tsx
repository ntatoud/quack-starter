import { DataTableSelectFilter } from "@quack/ui/components/data-table-select-filter";
import { useAddedFilters } from "@quack/ui/hooks/use-added-filters";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { usersColumns } from "#/features/users/admin/users-columns.tsx";
import {
  type UsersFilterKey,
  usersFilterKeys,
  usersFilterOfColumn,
  usersFilters,
} from "#/features/users/admin/users-filters.ts";
import {
  defaultUsersSorting,
  type UsersSearch,
  usersQueryOf,
} from "#/features/users/admin/users-search.ts";
import { UsersSearchInput } from "#/features/users/admin/users-search-input.tsx";
import { UsersTable } from "#/features/users/admin/users-table.tsx";

export function UsersList({ urlSearch }: { urlSearch: UsersSearch }) {
  const navigate = useNavigate({ from: "/users" });
  const query = usersQueryOf(urlSearch);
  const [searchInput, setSearchInput] = useState<HTMLInputElement | null>(null);
  const filters = useAddedFilters((key: UsersFilterKey) => urlSearch[key] !== undefined);

  const focusSearch = () => {
    searchInput?.focus();
    searchInput?.select();
  };

  // A new order or filter starts again from the first page.
  const columns = usersColumns({
    sorting: { column: query.orderBy, direction: query.dir },
    onSort: ({ column, direction }) => {
      const isDefault =
        column === defaultUsersSorting.orderBy && direction === defaultUsersSorting.dir;
      void navigate({
        search: ({ page: _, orderBy: __, dir: ___, ...rest }) =>
          isDefault ? rest : { ...rest, orderBy: column, dir: direction },
      });
    },
    onFilter: (column) => {
      const filter = usersFilterOfColumn[column];
      if (filter === "search") focusSearch();
      else filters.add(filter);
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <UsersSearchInput ref={setSearchInput} search={urlSearch.q ?? ""} />
        {usersFilterKeys.filter(filters.isShown).map((key) => (
          <DataTableSelectFilter
            key={key}
            title={usersFilters[key].title}
            options={usersFilters[key].options}
            value={urlSearch[key]}
            onValueChange={(value) => {
              void navigate({ search: ({ page: _, ...rest }) => ({ ...rest, [key]: value }) });
            }}
            open={filters.isOpen(key)}
            onOpenChange={(open) => filters.setOpen(key, open)}
            onRemove={() => {
              filters.remove(key);
              focusSearch();
              void navigate({ search: ({ page: _, [key]: __, ...rest }) => rest });
            }}
          />
        ))}
      </div>
      <UsersTable query={query} columns={columns} />
    </>
  );
}
