import type { Todo } from "@quack/contracts/todos/todo";
import { Button } from "@quack/ui/components/button";
import { Checkbox } from "@quack/ui/components/checkbox";
import { useMutation } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";

import { invalidateTodos } from "#/features/todos/invalidate-todos.ts";
import { api } from "#/lib/api.ts";

export function TodoItem({ todo }: { todo: typeof Todo.Encoded }) {
  const completeTodo = useMutation(
    api.todos.complete.mutationOptions({ ...invalidateTodos, onMutate: () => removeTodo.reset() }),
  );
  const removeTodo = useMutation(
    api.todos.remove.mutationOptions({ ...invalidateTodos, onMutate: () => completeTodo.reset() }),
  );
  const busy = completeTodo.isPending || removeTodo.isPending;
  const failed = completeTodo.isError || removeTodo.isError;

  return (
    <li className="group/todo flex min-h-11 items-center gap-3 px-3 py-1.5" aria-busy={busy}>
      <Checkbox
        checked={todo.completed}
        disabled={todo.completed || busy}
        onCheckedChange={() => completeTodo.mutate({ params: { id: todo.id } })}
        aria-label={`Complete ${todo.title}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={
            todo.completed
              ? "text-sm wrap-anywhere text-muted-foreground line-through"
              : "text-sm wrap-anywhere"
          }
        >
          {todo.title}
        </span>
        {failed && (
          <span role="alert" className="text-xs text-destructive">
            Could not update this todo. Try again.
          </span>
        )}
      </div>
      {/* Hidden until hover only where there is a hover: a touch screen would never show it. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="pointer-fine:opacity-0 pointer-fine:group-focus-within/todo:opacity-100 pointer-fine:group-hover/todo:opacity-100"
        disabled={busy}
        onClick={() => removeTodo.mutate({ params: { id: todo.id } })}
        aria-label={`Remove ${todo.title}`}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
