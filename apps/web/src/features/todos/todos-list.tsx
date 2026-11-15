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
import { useQuery } from "@tanstack/react-query";
import { ListTodoIcon } from "lucide-react";

import { TodoItem } from "#/features/todos/todo-item.tsx";
import { api } from "#/lib/api.ts";

export function TodosList() {
  const todos = useQuery(api.todos.list.queryOptions());

  if (todos.isPending) {
    return (
      <>
        <p role="status" className="sr-only">
          Loading todos…
        </p>
        <ul className="divide-y rounded-lg border" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex h-11 items-center gap-3 px-3">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-1/2" />
            </li>
          ))}
        </ul>
      </>
    );
  }

  // A failed refetch keeps the todos already loaded: only a first load that fails has nothing to show.
  if (todos.data === undefined) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>Could not load your todos</EmptyTitle>
          <EmptyDescription role="alert">Check your connection and try again.</EmptyDescription>
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
    );
  }

  if (todos.data.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListTodoIcon />
          </EmptyMedia>
          <EmptyTitle>No todos yet</EmptyTitle>
          <EmptyDescription>Add your first one above.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {todos.data.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
