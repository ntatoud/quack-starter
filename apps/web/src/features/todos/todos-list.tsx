import { Button } from "@quack/ui/components/button";
import { Checkbox } from "@quack/ui/components/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@quack/ui/components/empty";
import { Skeleton } from "@quack/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ListTodoIcon, Trash2Icon } from "lucide-react";

import { invalidateTodos } from "#/features/todos/invalidate-todos.ts";
import { api } from "#/lib/api.ts";

export function TodosList() {
  const todos = useQuery(api.todos.list.queryOptions());
  const completeTodo = useMutation(api.todos.complete.mutationOptions(invalidateTodos));
  const removeTodo = useMutation(api.todos.remove.mutationOptions(invalidateTodos));

  if (todos.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <p role="status" className="sr-only">
          Loading todos…
        </p>
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    );
  }

  if (todos.isError) {
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

  const isBusy = (id: string) =>
    (completeTodo.isPending && completeTodo.variables.params.id === id) ||
    (removeTodo.isPending && removeTodo.variables.params.id === id);

  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y rounded-lg border">
        {todos.data.map((todo) => (
          <li
            key={todo.id}
            className="group/todo flex min-h-11 items-center gap-3 px-3 py-1.5"
            aria-busy={isBusy(todo.id)}
          >
            <label className="flex min-w-0 flex-1 items-center gap-3">
              <Checkbox
                checked={todo.completed}
                disabled={todo.completed || isBusy(todo.id)}
                onCheckedChange={() => completeTodo.mutate({ params: { id: todo.id } })}
                aria-label={`Complete ${todo.title}`}
              />
              <span
                className={
                  todo.completed
                    ? "min-w-0 flex-1 text-sm wrap-anywhere text-muted-foreground line-through"
                    : "min-w-0 flex-1 text-sm wrap-anywhere"
                }
              >
                {todo.title}
              </span>
            </label>
            {/* Hidden until hover only where there is a hover: a touch screen would never show it. */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="pointer-fine:opacity-0 pointer-fine:group-focus-within/todo:opacity-100 pointer-fine:group-hover/todo:opacity-100"
              disabled={isBusy(todo.id)}
              onClick={() => removeTodo.mutate({ params: { id: todo.id } })}
              aria-label={`Remove ${todo.title}`}
            >
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>
      {(completeTodo.isError || removeTodo.isError) && (
        <p role="alert" className="text-sm text-destructive">
          Could not update the todo. Try again.
        </p>
      )}
    </div>
  );
}
