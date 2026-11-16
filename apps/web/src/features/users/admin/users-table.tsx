import type { User } from "@quack/contracts/identity/user";
import { defaultPageSize } from "@quack/contracts/pagination/paginated";
import { Button } from "@quack/ui/components/button";
import { DataTable, type DataTableColumn } from "@quack/ui/components/data-table";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@quack/ui/components/empty";
import { Skeleton } from "@quack/ui/components/skeleton";
import { matchQuery } from "@quack/ui-state/query";
import { useQuery } from "@tanstack/react-query";
import { Option } from "effect";
import { UsersIcon } from "lucide-react";

import { ButtonLink } from "#/components/button-link.tsx";
import { PagePagination, pageCount } from "#/components/page-pagination.tsx";
import { labelOf } from "#/features/users/admin/users-filters.ts";
import { usersQueryOptions } from "#/features/users/admin/users-query.ts";
import type { UsersQuery } from "#/features/users/admin/users-search.ts";

const emptyTitle = ({ search, status, role, team }: UsersQuery, total: number) => {
  if (total > 0) return "No users on this page";
  if (search !== "") return `No users match “${search}”`;
  if (status !== undefined || team !== undefined) return "No users match these filters";
  if (role !== undefined) return `No users have the Role ${labelOf("role", role)}`;
  return "No users on this page";
};

export function UsersTable({
  query,
  columns,
}: {
  query: UsersQuery;
  columns: ReadonlyArray<DataTableColumn<User>>;
}) {
  const users = useQuery(usersQueryOptions(query));

  return matchQuery(users, {
    Pending: () => (
      <>
        <p role="status" className="sr-only">
          Loading users…
        </p>
        <ul className="divide-y rounded-lg border" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex h-10 items-center justify-between gap-3 px-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-12" />
            </li>
          ))}
        </ul>
      </>
    ),
    Error: () => (
      <Empty className="border border-dashed">
        <EmptyHeader role="alert">
          <EmptyTitle>Could not load the users</EmptyTitle>
          <EmptyDescription>Check your connection and try again.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            size="sm"
            disabled={users.isFetching}
            onClick={() => users.refetch()}
          >
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    ),
    Success: ({ data: { items, total }, refreshError }) => (
      <>
        {Option.isSome(refreshError) && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <span>Could not refresh the users.</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={users.isFetching}
              onClick={() => users.refetch()}
            >
              Try again
            </Button>
          </p>
        )}
        <DataTable
          columns={columns}
          data={items}
          sorting={{ column: query.orderBy, direction: query.dir }}
          getRowId={(user) => user.id}
          className="transition-opacity aria-busy:opacity-60"
          aria-busy={users.isPlaceholderData}
          empty={
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>{emptyTitle(query, total)} </EmptyTitle>
              </EmptyHeader>
              {total > 0 && (
                <EmptyContent>
                  <ButtonLink
                    to="/users"
                    search={({ page: _, ...rest }) => rest}
                    variant="outline"
                    size="sm"
                  >
                    Go to the first page
                  </ButtonLink>
                </EmptyContent>
              )}
            </Empty>
          }
          footer={
            <PagePagination
              page={query.page}
              pages={pageCount(total, defaultPageSize)}
              aria-label="Pages of users"
            />
          }
        />
      </>
    ),
  });
}
