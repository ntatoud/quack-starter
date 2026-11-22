import type { Todo } from "@quack/contracts/todos/todo";
import { Button } from "@quack/ui/components/button";
import { Checkbox } from "@quack/ui/components/checkbox";
import { useMutation } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";

import { invalidateTodos } from "#/features/todos/invalidate-todos.ts";
import { api } from "#/lib/api.ts";

export function TodoItem({ todo }: { todo: Todo }) {
  const completeTodo = useMutation(
    api.todos.complete.mutationOptions({
      ...invalidateTodos,
      onMutate: (): void => removeTodo.reset(),
    }),
  );
  const removeTodo = useMutation(
    api.todos.remove.mutationOptions({
      ...invalidateTodos,
      onMutate: (): void => completeTodo.reset(),
    }),
  );
  const busy = completeTodo.isPending || removeTodo.isPending;

  return (
    <li className="group/todo flex items-center gap-3 py-3 pr-3 pl-5" aria-busy={busy}>
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
        {(completeTodo.isError || removeTodo.isError) && (
          <span role="alert" className="text-sm text-destructive">
            {completeTodo.isError
              ? "Could not complete this todo. Try again."
              : "Could not remove this todo. Try again."}
          </span>
        )}
      </div>
      {/* Hidden until hover only on a wide screen with a mouse: a touch screen would never show it, and a phone's layout,
          also seen in a narrow window or a browser's device mode that keeps the mouse, always shows it. */}
      {/* `-my-1`: the title sets the height of the row, not the button. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="-my-1 md:pointer-fine:opacity-0 md:pointer-fine:group-focus-within/todo:opacity-100 md:pointer-fine:group-hover/todo:opacity-100"
        disabled={busy}
        onClick={() => removeTodo.mutate({ params: { id: todo.id } })}
        aria-label={`Remove ${todo.title}`}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
