import { Button } from "@quack/ui/components/button";
import { Checkbox } from "@quack/ui/components/checkbox";
import {
  Empty,
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
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading todos">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    );
  }

  if (todos.isError) {
    return (
      <p className="text-sm text-destructive">Could not reach the API. Is the server running?</p>
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
        <li key={todo.id} className="group flex min-h-11 items-center gap-3 px-3 py-1.5">
          <Checkbox
            checked={todo.completed}
            disabled={todo.completed}
            onCheckedChange={() => completeTodo.mutate({ params: { id: todo.id } })}
            aria-label={`Complete ${todo.title}`}
          />
          <span
            className={
              todo.completed
                ? "flex-1 text-sm text-muted-foreground line-through"
                : "flex-1 text-sm"
            }
          >
            {todo.title}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
            onClick={() => removeTodo.mutate({ params: { id: todo.id } })}
            aria-label={`Remove ${todo.title}`}
          >
            <Trash2Icon />
          </Button>
        </li>
      ))}
    </ul>
  );
}
