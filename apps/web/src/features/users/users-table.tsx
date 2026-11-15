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
import { useQuery } from "@tanstack/react-query";
import { UsersIcon } from "lucide-react";

import { ButtonLink } from "#/components/button-link.tsx";
import { usersColumns } from "#/features/users/users-columns.tsx";
import { UsersPagination } from "#/features/users/users-pagination.tsx";
import { usersPageSize, usersQueryOptions } from "#/features/users/users-query.ts";

export function UsersTable({ page }: { page: number }) {
  const users = useQuery(usersQueryOptions(page));

  if (users.isPending) {
    return (
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
    );
  }

  if (users.data === undefined) {
    return (
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
    );
  }

  const { items, total } = users.data;
  const pages = Math.max(1, Math.ceil(total / usersPageSize));

  return (
    <>
      {users.isRefetchError && (
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
              <EmptyTitle>No users on this page</EmptyTitle>
              {total > 0 && (
                <EmptyDescription>
                  {pages === 1
                    ? "There is one page of users."
                    : `There are ${pages} pages of users.`}
                </EmptyDescription>
              )}
            </EmptyHeader>
            {total > 0 && (
              <EmptyContent>
                <ButtonLink to="/users" search={{}} variant="outline" size="sm">
                  Go to the first page
                </ButtonLink>
              </EmptyContent>
            )}
          </Empty>
        }
        footer={
          <div className="@container">
            <div className="flex flex-col items-center gap-2 @xl:flex-row @xl:justify-between">
              <p
                aria-live="polite"
                className="shrink-0 text-sm whitespace-nowrap text-muted-foreground"
              >
                Page {page} of {pages}
              </p>
              <UsersPagination page={page} pages={pages} />
            </div>
          </div>
        }
      />
    </>
  );
}
