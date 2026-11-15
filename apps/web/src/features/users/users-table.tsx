import { Badge } from "@quack/ui/components/badge";
import { Button } from "@quack/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@quack/ui/components/empty";
import { Skeleton } from "@quack/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@quack/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "lucide-react";

import { ButtonLink } from "#/components/button-link.tsx";
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
            <li key={row} className="flex h-11 items-center justify-between gap-3 px-3">
              <Skeleton className="h-4 w-1/2" />
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
    <div className="flex flex-col gap-4">
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
      {items.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No users on this page</EmptyTitle>
            {total > 0 && <EmptyDescription>There are {pages} pages of users.</EmptyDescription>}
          </EmptyHeader>
          {total > 0 && (
            <EmptyContent>
              <ButtonLink to="/users" search={{}} variant="outline" size="sm">
                Go to the first page
              </ButtonLink>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div
          className="rounded-lg border transition-opacity data-placeholder:opacity-60"
          data-placeholder={users.isPlaceholderData || undefined}
          aria-busy={users.isPlaceholderData}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-3">Email</TableHead>
                <TableHead className="w-24 px-3">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="px-3">{user.email}</TableCell>
                  <TableCell className="px-3">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "Admin" : "User"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <nav aria-label="Pages of users" className="flex items-center justify-between gap-2">
        <ButtonLink
          to="/users"
          search={page - 1 === 1 ? {} : { page: page - 1 }}
          disabled={page <= 1}
          variant="outline"
          size="sm"
          className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <ChevronLeftIcon />
          Previous
        </ButtonLink>
        <p className="text-sm text-muted-foreground">
          Page {page} of {pages}
        </p>
        <ButtonLink
          to="/users"
          search={{ page: page + 1 }}
          disabled={page >= pages}
          variant="outline"
          size="sm"
          className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Next
          <ChevronRightIcon />
        </ButtonLink>
      </nav>
    </div>
  );
}
