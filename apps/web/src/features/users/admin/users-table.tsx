import { defaultPageSize } from "@quack/contracts/pagination/paginated";
import { Button } from "@quack/ui/components/button";
import { DataTable } from "@quack/ui/components/data-table";
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
import { usersColumns } from "#/features/users/admin/users-columns.tsx";
import { usersQueryOptions } from "#/features/users/admin/users-query.ts";

export function UsersTable({ page, search }: { page: number; search: string }) {
  const users = useQuery(usersQueryOptions(page, search));

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
          columns={usersColumns}
          data={items}
          getRowId={(user) => user.id}
          className="transition-opacity aria-busy:opacity-60"
          aria-busy={users.isPlaceholderData}
          empty={
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {total === 0 && search.trim() !== ""
                    ? `No users match “${search.trim()}”`
                    : "No users on this page"}
                </EmptyTitle>
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
              page={page}
              pages={pageCount(total, defaultPageSize)}
              aria-label="Pages of users"
            />
          }
        />
      </>
    ),
  });
}
