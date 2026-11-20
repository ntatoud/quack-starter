import { DataTableAddFilter } from "@quack/ui/components/data-table-add-filter";
import { DataTableSelectFilter } from "@quack/ui/components/data-table-select-filter";
import { useAddedFilters } from "@quack/ui/hooks/use-added-filters";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { UsersColumnPicker } from "#/features/users/admin/users-column-picker.tsx";
import { type HideableUsersColumn, usersColumns } from "#/features/users/admin/users-columns.tsx";
import {
  type UsersFilterKey,
  usersFilterKeys,
  usersFilterOfColumn,
  usersFilters,
} from "#/features/users/admin/users-filters.ts";
import { usersQueryOptions } from "#/features/users/admin/users-query.ts";
import {
  defaultUsersSorting,
  type UsersSearch,
  usersQueryOf,
} from "#/features/users/admin/users-search.ts";
import { UsersSearchInput } from "#/features/users/admin/users-search-input.tsx";
import { UsersTable } from "#/features/users/admin/users-table.tsx";

const hiddenByDefault: ReadonlySet<HideableUsersColumn> = new Set(["jobTitle", "tags", "verified"]);

export function UsersList({ urlSearch }: { urlSearch: UsersSearch }) {
  const navigate = useNavigate({ from: "/admin/users" });
  const query = usersQueryOf(urlSearch);
  const [searchInput, setSearchInput] = useState<HTMLInputElement | null>(null);
  const filters = useAddedFilters((key: UsersFilterKey) => urlSearch[key] !== undefined);
  const [hiddenColumns, setHiddenColumns] =
    useState<ReadonlySet<HideableUsersColumn>>(hiddenByDefault);
  // Relative dates count from when the page was fetched: the render stays pure, and they read the same until the next fetch.
  const { dataUpdatedAt } = useQuery(usersQueryOptions(query));

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
      else if (filter !== undefined) filters.add(filter);
    },
    hidden: hiddenColumns,
    now: new Date(dataUpdatedAt),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <UsersSearchInput ref={setSearchInput} search={urlSearch.q ?? ""} />
        <DataTableAddFilter
          filters={usersFilterKeys
            .filter((key) => !filters.isShown(key))
            .map((key) => ({ key, title: usersFilters[key].title }))}
          onAdd={filters.add}
        />
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
        <div className="ml-auto">
          <UsersColumnPicker hidden={hiddenColumns} onHiddenChange={setHiddenColumns} />
        </div>
      </div>
      <UsersTable query={query} columns={columns} />
    </>
  );
}
