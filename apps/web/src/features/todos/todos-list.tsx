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
import { matchQuery } from "@quack/ui-state/query";
import { useQuery } from "@tanstack/react-query";
import { Option } from "effect";
import { ListTodoIcon } from "lucide-react";

import { TodoItem } from "#/features/todos/todo-item.tsx";
import { api } from "#/lib/api.ts";

export function TodosList() {
  const todos = useQuery(api.todos.list.queryOptions());

  return matchQuery(todos, {
    Pending: () => (
      <>
        <p role="status" className="sr-only">
          Loading todos…
        </p>
        <ul className="divide-y rounded-xl border" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex h-11 items-center gap-3 px-5">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-1/2" />
            </li>
          ))}
        </ul>
      </>
    ),
    Error: () => (
      <Empty className="border border-dashed">
        <EmptyHeader role="alert">
          <EmptyTitle>Could not load your todos</EmptyTitle>
          <EmptyDescription>Check your connection and try again.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            size="sm"
            disabled={todos.isFetching}
            onClick={() => todos.refetch()}
          >
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    ),
    Success: ({ data, refreshError }) => (
      <div className="flex flex-col gap-4">
        {Option.isSome(refreshError) && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <span>Could not refresh your todos.</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-sm"
              disabled={todos.isFetching}
              onClick={() => todos.refetch()}
            >
              Try again
            </Button>
          </p>
        )}
        {data.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListTodoIcon />
              </EmptyMedia>
              <EmptyTitle>No todos yet</EmptyTitle>
              <EmptyDescription>Add your first one above.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y rounded-xl border">
            {data.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}
          </ul>
        )}
      </div>
    ),
  });
}
